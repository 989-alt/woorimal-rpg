#!/usr/bin/env python3
"""소리 파일 살펴보기 (귀 대신 숫자로). ffprobe·ffmpeg가 있어야 한다.

사용: python3 -I tools/audio-check.py FILE... [--json]
파일마다: 길이(초), 채널·표본률·비트율, 통합 음량(LUFS, ebur128), 음량 범위(LRA), 참 피크(dBTP),
최대 표본(dBFS, volumedetect), 앞쪽 무음 길이(초, -50 dB 아래), 끝쪽 무음 길이(초).
"""
import json, re, subprocess, sys


def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=False)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=channels,sample_rate,codec_name",
             "-of", "json", path])
    d = json.loads(r.stdout or "{}")
    st = (d.get("streams") or [{}])[0]
    fm = d.get("format") or {}
    return {"duration": round(float(fm.get("duration", 0)), 3), "codec": st.get("codec_name"),
            "channels": st.get("channels"), "rate": int(st.get("sample_rate", 0) or 0),
            "kbps": round(int(fm.get("bit_rate", 0) or 0) / 1000)}


def loudness(path):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true,volumedetect", "-f", "null", "-"])
    err = r.stderr
    tail = err[err.rfind("Summary:"):] if "Summary:" in err else err
    num = lambda pat, s=tail: (float(m.group(1)) if (m := re.search(pat, s)) else None)
    return {"lufs": num(r"I:\s+(-?[\d.]+|-inf) LUFS"), "lra": num(r"LRA:\s+(-?[\d.]+) LU"),
            "true_peak": num(r"Peak:\s+(-?[\d.]+|-inf) dBFS"), "max_volume": num(r"max_volume:\s+(-?[\d.]+) dB", err)}


def silences(path, duration):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "silencedetect=noise=-50dB:d=0.05", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    lead = ends[0] if starts and starts[0] <= 0.01 and ends else 0.0
    trail = round(duration - starts[-1], 3) if starts and len(starts) > len(ends) else 0.0
    return {"lead_silence": round(lead, 3), "tail_silence": max(0.0, trail)}


def check(path):
    info = probe(path)
    info.update(loudness(path))
    info.update(silences(path, info["duration"]))
    info["file"] = path
    return info


if __name__ == "__main__":
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = [check(f) for f in files]
    if "--json" in sys.argv:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    else:
        for i in out:
            print(f"{i['file']}: {i['duration']}s {i['codec']} {i['channels']}ch {i['rate']}Hz {i['kbps']}kbps "
                  f"I={i['lufs']} LUFS LRA={i['lra']} TP={i['true_peak']} dBTP max={i['max_volume']} dB "
                  f"lead={i['lead_silence']}s tail={i['tail_silence']}s")
