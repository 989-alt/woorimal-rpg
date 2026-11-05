#!/usr/bin/env python3
"""KIE.AI Suno로 배경음악·효과음 후보를 만든다 (호출당 과금).

사용: KIE_AI_API_KEY=... python3 -I tools/kie-audio.py --jobs design/audio/jobs.json --job ID \
        --out-dir design/audio/raw --ledger design/audio/credits.tsv --cap 250
- jobs.json의 한 항목(id, kind, ...)으로 작업을 만들고 끝날 때까지 기다린 뒤 모든 결과(Suno는 보통 2개)를
  OUT_DIR/ID_1.mp3, ID_2.mp3 …로 받고, 옆에 ID.json(요청, taskId, 크레딧, 결과마다 title·tags·duration)을 남긴다.
- kind "music": ai-music-api/generate, custom_mode + instrumental(가사 없음). 항목의 title, style, negative_tags,
  duration(초), style_weight, weirdness_constraint를 넘긴다.
- kind "sound": ai-music-api/sounds. 항목의 prompt, sound_loop, sound_tempo, sound_key를 넘긴다.
- 크레딧 장부(탭 구분 taskId label kind out credits status): 키 확인보다 먼저 장부 합계 + 예상이 상한을 넘으면
  종료 코드 3으로 멈춘다. 작업을 만들면 pending 줄(예상값)을 더하고, 성공하면 응답의 creditsConsumed와 ok로,
  실패·시간 초과면 fail(예상값 유지)로 고친다. 합계는 상태와 상관없이 모든 줄을 더한다.
- 키는 출력하지 않는다.
"""
import argparse, fcntl, json, os, ssl, sys, time, urllib.request
from contextlib import contextmanager

API = "https://api.kie.ai/api/v1/jobs"
EST = {"music": 12, "sound": 12}
HEADER = ["taskId", "label", "kind", "out", "credits", "status"]


def ctx():
    ca = "/root/.ccr/ca-bundle.crt"
    return ssl.create_default_context(cafile=ca) if os.path.exists(ca) else ssl.create_default_context()


def call(method, url, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, context=ctx(), timeout=60) as r:
        out = json.load(r)
    if out.get("code") != 200:
        raise SystemExit(f"KIE error {out.get('code')}: {out.get('msg')}")
    return out["data"]


def ledger_rows(path):
    if not os.path.exists(path):
        return []
    lines = [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8") if l.strip()]
    return [r for r in lines if r and r[0] != "taskId"]


def ledger_total(rows):
    return sum(float(r[4]) for r in rows if len(r) > 4)


def ledger_write(path, rows):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\t".join(HEADER) + "\n")
        for r in rows:
            f.write("\t".join(str(v) for v in r) + "\n")


@contextmanager
def ledger_lock(path):
    """여러 작업을 함께 돌려도 장부 읽기·쓰기가 섞이지 않게 잠근다."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path + ".lock", "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        yield


def ledger_set(path, task, credits, status):
    with ledger_lock(path):
        rows = ledger_rows(path)
        for r in rows:
            if r[0] == task:
                r[4], r[5] = fmt(credits), status
        ledger_write(path, rows)


def fmt(v):
    v = float(v)
    return str(int(v)) if v == int(v) else str(v)


def build(job):
    if job["kind"] == "music":
        inp = {"custom_mode": True, "instrumental": True, "model": job.get("model", "V6"),
               "title": job["title"], "style": job["style"]}
        for k in ("negative_tags", "duration", "style_weight", "weirdness_constraint", "variety"):
            if k in job:
                inp[k] = job[k]
        return {"model": "ai-music-api/generate", "input": inp}
    if job["kind"] == "sound":
        inp = {"prompt": job["prompt"], "model": job.get("model", "V6"), "sound_loop": job.get("sound_loop", False)}
        for k in ("sound_tempo", "sound_key"):
            if k in job:
                inp[k] = job[k]
        return {"model": "ai-music-api/sounds", "input": inp}
    sys.exit(f"모르는 kind: {job['kind']}")


def poll(task, key, timeout):
    t0 = time.time()
    while True:
        time.sleep(8)
        d = call("GET", f"{API}/recordInfo?taskId={task}", key)
        if d["state"] == "success":
            return d
        if d["state"] == "fail":
            raise RuntimeError(f"실패: {d.get('failCode')} {d.get('failMsg')}")
        if time.time() - t0 > timeout:
            raise RuntimeError(f"시간 초과 (taskId {task})")


def clips_of(d):
    resp = d.get("response")
    if not resp and d.get("resultJson"):
        resp = json.loads(d["resultJson"])
    if isinstance(resp, dict):
        for k in ("data", "sunoData", "clips"):
            if isinstance(resp.get(k), list):
                return resp[k]
        if isinstance(resp.get("resultUrls"), list):
            return [{"audio_url": u} for u in resp["resultUrls"]]
    return resp if isinstance(resp, list) else []


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--jobs", required=True)
    p.add_argument("--job", required=True)
    p.add_argument("--out-dir", required=True)
    p.add_argument("--timeout", type=int, default=900)
    p.add_argument("--ledger", required=True)
    p.add_argument("--cap", type=float, required=True)
    a = p.parse_args()
    jobs = {j["id"]: j for j in json.load(open(a.jobs, encoding="utf-8"))["jobs"]}
    job = jobs.get(a.job) or sys.exit(f"jobs에 {a.job} 없음")
    est = job.get("estimate", EST[job["kind"]])
    key = os.environ.get("KIE_AI_API_KEY") or sys.exit("KIE_AI_API_KEY가 없습니다")
    body = build(job)
    out_glob = os.path.join(a.out_dir, f"{a.job}_*.mp3")
    # 상한 확인과 작업 만들기, pending 줄 쓰기를 한 잠금 안에서 한다(함께 돌리는 작업이 상한을 함께 넘지 않게).
    with ledger_lock(a.ledger):
        total = ledger_total(ledger_rows(a.ledger))
        if total + est > a.cap:
            print(f"크레딧 상한: 장부 합계 {fmt(total)} + 예상 {est} > {fmt(a.cap)}", file=sys.stderr)
            sys.exit(3)
        task = call("POST", f"{API}/createTask", key, body)["taskId"]
        print(f"task {task} ({a.job})", flush=True)
        ledger_write(a.ledger, ledger_rows(a.ledger) + [[task, a.job, job["kind"], out_glob, est, "pending"]])
    try:
        d = poll(task, key, a.timeout)
    except BaseException as e:
        ledger_set(a.ledger, task, est, "fail")
        sys.exit(str(e))
    credits = d.get("creditsConsumed")
    ledger_set(a.ledger, task, credits if credits is not None else est, "ok")
    os.makedirs(a.out_dir, exist_ok=True)
    meta = []
    for i, c in enumerate(clips_of(d), 1):
        url = c.get("audio_url") or c.get("audioUrl") or c.get("source_audio_url")
        out = os.path.join(a.out_dir, f"{a.job}_{i}.mp3")
        if url:
            with urllib.request.urlopen(url, context=ctx(), timeout=180) as r, open(out, "wb") as f:
                f.write(r.read())
        meta.append({"out": out if url else None, "title": c.get("title"), "tags": c.get("tags"),
                     "duration": c.get("duration"), "model_name": c.get("model_name"), "id": c.get("id"),
                     "prompt": c.get("prompt")})
    rep = {"request": body, "taskId": task, "credits": credits, "costTime": d.get("costTime"), "clips": meta}
    json.dump(rep, open(os.path.join(a.out_dir, f"{a.job}.json"), "w"), ensure_ascii=False, indent=1)
    for m in meta:
        print(f"saved {m['out']} title={m['title']!r} tags={m['tags']!r} duration={m['duration']}")
    rows = ledger_rows(a.ledger)
    print(f"credits {credits} · 합계 {fmt(ledger_total(rows))} / {fmt(a.cap)}", flush=True)


if __name__ == "__main__":
    main()
