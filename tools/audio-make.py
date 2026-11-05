#!/usr/bin/env python3
"""고른 후보 소리로 게임용 파일을 만든다: (음악) 이음매 없는 되풀이 구간 찾기·크로스페이드, 음량 맞추기, MP3로 줄이기.

사용: python3 -I tools/audio-make.py --manifest design/audio/tracks.json [--only KEY ...] [--dry]
manifest의 항목마다:
  key      게임 안 이름(data/assets.js의 ASSETS.audio.music/sfx 키)
  src      후보 파일(design/audio/raw/…)
  out      만들 파일(assets/audio/…)
  kind     "music" | "sfx"
  loop     true면 되풀이 구간을 찾아 끝을 시작 앞부분과 크로스페이드한다(파일 끝 → 처음이 이어진다)
  min_len, max_len  되풀이 구간 길이(초) 범위 (loop일 때)
  bpm      요청한 빠르기(박 길이를 찾을 때 실마리)
  t0, t1   (선택) 되풀이 구간을 손으로 정할 때(초)
  xf       크로스페이드 길이(초, 기본 1.5)
  start, end  (선택) 쓸 범위(초). loop가 아니면 이 범위를 자르고 끝을 fade_out초 동안 줄인다
  fade_in, fade_out  (선택, 초) loop가 아닐 때
  lufs     목표 통합 음량(기본 음악 -20, 효과음 -16)
  kbps     MP3 비트율(기본 음악 96, 효과음 64), mono(기본 효과음만 true)
되풀이 구간은 마디(4박) 길이의 정수배 후보 가운데, 이음매 앞뒤(시작 앞 xf+2초 ↔ 끝 앞 xf+2초, 시작 뒤 2초 ↔ 끝 뒤 2초)의
음색(로그 대역 에너지)·박 세기 모양이 가장 닮은 쌍을 고른다. 끝의 잦아듦(페이드아웃)은 피한다.
"""
import argparse, json, os, re, subprocess, sys
import numpy as np

SR = 44100


def decode(path, start=None, end=None):
    args = ["ffmpeg", "-v", "error"]
    if start is not None:
        args += ["-ss", str(start)]
    if end is not None:
        args += ["-to", str(end)]
    args += ["-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, 2).copy()


def features(x, hop=1024, n=4096):
    m = x.mean(axis=1)
    frames = 1 + max(0, (len(m) - n) // hop)
    win = np.hanning(n).astype(np.float32)
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(m[idx] * win, axis=1))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    edges = np.geomspace(60, 12000, 33)
    bands = np.stack([spec[:, (freqs >= lo) & (freqs < hi)].sum(axis=1) for lo, hi in zip(edges[:-1], edges[1:])], axis=1)
    logb = np.log1p(bands * 10)
    onset = np.maximum(0, np.diff(logb, axis=0, prepend=logb[:1])).sum(axis=1)
    rms = np.sqrt((m[idx] ** 2).mean(axis=1) + 1e-12)
    return logb, onset, 20 * np.log10(rms), hop / SR


def tempo(onset, fps, hint=None):
    """박 길이(초). hint(요청한 bpm)가 있으면 그 ±10%(와 두 배·절반) 안에서만 찾는다(3:2로 잘못 잡지 않게)."""
    o = onset - onset.mean()
    ac = np.correlate(o, o, mode="full")[len(o) - 1:]
    if hint:
        best = None
        for mult in (1.0, 2.0, 0.5):
            period = 60 / (hint * mult) * fps
            lo, hi = int(period * 0.9), int(np.ceil(period * 1.1))
            if lo < 2 or hi >= len(ac):
                continue
            lag = lo + int(np.argmax(ac[lo:hi + 1]))
            if best is None or ac[lag] > best[1] * 1.15:  # 요청한 빠르기를 먼저 믿는다
                best = (lag, ac[lag], mult)
        lag, _, mult = best
        if 1 <= lag < len(ac) - 1:  # 꼭짓점 보간
            a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
            d = a - 2 * b + c
            lag = lag + (0.5 * (a - c) / d if d else 0)
        return float(lag / fps * mult)  # 요청한 빠르기의 박 길이로 돌린다
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 60)
    lag = lo + int(np.argmax(ac[lo:hi]))
    return float(lag / fps)


def cos(a, b):
    a = a.ravel() - a.mean(); b = b.ravel() - b.mean()
    d = np.linalg.norm(a) * np.linalg.norm(b)
    return float(a @ b / d) if d > 0 else 0.0


def find_loop(x, min_len, max_len, xf, bpm=None):
    logb, onset, db, dt = features(x)
    fps = 1 / dt
    beat = tempo(onset, fps, bpm)
    total = len(x) / SR
    # 잦아드는 끝 피하기: 큰 소리(중앙값 -6 dB 아래로 떨어지기 전)까지만 쓴다
    loud = np.convolve(db, np.ones(int(fps)) / int(fps), mode="same")
    med = np.median(loud)
    good = np.where(loud >= med - 6)[0]
    usable_end = min(total - 1.0, good[-1] * dt - 1.0) if len(good) else total - 1.0
    first_loud = good[0] * dt if len(good) else 0.0
    w = int(round(2.0 * fps))
    wx = int(round((xf + 2.0) * fps))
    best = None
    t0s = np.arange(max(xf + 2.2, first_loud + 0.5), min(30.0, usable_end - min_len), dt * 2)
    for t0 in t0s:
        f0 = int(round(t0 * fps))
        if f0 - wx < 0 or f0 + w >= len(logb):
            continue
        k_min = int(np.ceil(min_len / beat)); k_max = int(np.floor(max_len / beat))
        for k in range(k_min, k_max + 1):
            if k % 4:  # 마디(4박) 단위로만 자른다
                continue
            for jitter in np.arange(-beat / 8, beat / 8 + 1e-9, dt):
                t1 = t0 + k * beat + jitter
                if t1 > usable_end:
                    break
                f1 = int(round(t1 * fps))
                if f1 + w >= len(logb):
                    break
                s_before = cos(logb[f0 - wx:f0], logb[f1 - wx:f1])
                s_after = cos(logb[f0:f0 + w], logb[f1:f1 + w])
                s_on = cos(onset[f0 - wx:f0 + w], onset[f1 - wx:f1 + w])
                lvl = -abs(loud[f0] - loud[f1]) / 6  # 이음매 앞뒤 음량이 비슷할수록
                score = s_before + s_after + s_on + 0.3 * lvl + 0.002 * (t1 - t0)
                if best is None or score > best[0]:
                    best = (score, t0, t1, s_before, s_after, s_on)
    if best is None:
        raise SystemExit("되풀이 구간을 찾지 못했다")
    score, t0, t1, sb, sa, so = best
    return {"t0": round(float(t0), 3), "t1": round(float(t1), 3), "beat": round(beat, 4), "bpm": round(60 / beat, 1),
            "score": round(score, 3), "sim_before": round(sb, 3), "sim_after": round(sa, 3), "sim_onset": round(so, 3),
            "usable_end": round(float(usable_end), 2)}


def make_loop(x, t0, t1, xf):
    s0, s1, n = int(round(t0 * SR)), int(round(t1 * SR)), int(round(xf * SR))
    body = x[s0:s1].copy()
    t = np.linspace(0, np.pi / 2, n, dtype=np.float32)[:, None]
    body[-n:] = x[s1 - n:s1] * np.cos(t) + x[s0 - n:s0] * np.sin(t)  # 같은 힘 크로스페이드: 끝이 시작 바로 앞 소리로 바뀐다
    return body


def fades(x, fin, fout):
    if fin:
        n = min(len(x), int(fin * SR)); x[:n] *= np.linspace(0, 1, n, dtype=np.float32)[:, None]
    if fout:
        n = min(len(x), int(fout * SR)); x[-n:] *= np.linspace(1, 0, n, dtype=np.float32)[:, None] ** 2
    return x


def trim_silence(x, db=-50):
    """앞뒤의 무음(-50 dBFS 아래)을 걷어 낸다(효과음)."""
    th = 10 ** (db / 20)
    loud = np.where(np.abs(x).max(axis=1) > th)[0]
    return x[loud[0]:loud[-1] + 1] if len(loud) else x


def measure(path_or_wav):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path_or_wav, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", tail); p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail)
    return (float(i.group(1)) if i else None), (float(p.group(1)) if p else None)


def write_wav(path, x):
    import wave
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def short_lufs(x):
    """짧은 소리(400 ms보다 짧으면 ebur128이 재지 못한다)는 조용한 꼬리를 붙여 잰다."""
    pad = np.zeros((int(0.5 * SR), x.shape[1]), dtype=np.float32)
    return np.concatenate([x, pad]) if len(x) < 0.6 * SR else x


def build(t, tmp):
    kind = t["kind"]
    x = decode(t["src"], t.get("start"), t.get("end"))
    info = {}
    if t.get("loop"):
        xf = t.get("xf", 1.5)
        if "t0" in t and "t1" in t:
            info = {"t0": t["t0"], "t1": t["t1"]}
        else:
            info = find_loop(x, t["min_len"], t["max_len"], xf, t.get("bpm"))
        x = make_loop(x, info["t0"], info["t1"], xf)
    else:
        if kind == "sfx":
            x = trim_silence(x)
        x = fades(x, t.get("fade_in", 0.0 if kind == "sfx" else 0.0), t.get("fade_out", 0.0))
    if t.get("mono", kind == "sfx"):
        x = np.repeat(x.mean(axis=1, keepdims=True), 2, axis=1)
    target = t.get("lufs", -20.0 if kind == "music" else -16.0)
    wav = os.path.join(tmp, t["key"] + ".wav")
    write_wav(wav, short_lufs(x))
    lufs, peak = measure(wav)
    gain = target - lufs
    ceiling = t.get("peak", -1.5)
    if peak + gain > ceiling:  # 피크가 넘치면 목표보다 조금 조용하게 둔다(찌그러뜨리지 않는다)
        gain = ceiling - peak
    x = x * np.float32(10 ** (gain / 20))
    write_wav(wav, x)
    mono = t.get("mono", kind == "sfx")
    kbps = t.get("kbps", 96 if kind == "music" else 64)
    os.makedirs(os.path.dirname(t["out"]), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1" if mono else "2", "-ar", str(SR),
                    "-c:a", "libmp3lame", "-b:a", f"{kbps}k", "-map_metadata", "-1", "-id3v2_version", "0", "-write_xing", "1", t["out"]],
                   check=True)
    info.update({"gain_db": round(gain, 2), "src_lufs": lufs, "len": round(len(x) / SR, 3)})
    return info


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True)
    p.add_argument("--only", nargs="*")
    p.add_argument("--tmp", default=os.environ.get("TMPDIR", "/tmp"))
    p.add_argument("--find", action="store_true", help="되풀이 구간만 찾아 보여 준다(파일을 만들지 않음)")
    a = p.parse_args()
    man = json.load(open(a.manifest, encoding="utf-8"))
    for t in man["tracks"]:
        if a.only and t["key"] not in a.only:
            continue
        if a.find:
            x = decode(t["src"], t.get("start"), t.get("end"))
            print(t["key"], json.dumps(find_loop(x, t["min_len"], t["max_len"], t.get("xf", 1.5), t.get("bpm"))), flush=True)
            continue
        info = build(t, a.tmp)
        print(t["key"], t["out"], json.dumps(info), flush=True)


if __name__ == "__main__":
    main()
