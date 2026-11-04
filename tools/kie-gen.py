#!/usr/bin/env python3
"""KIE.AI GPT Image 2.5로 그림 한 장을 만든다 (구독 한도에 닿았을 때 쓰는 대체 경로, 호출당 과금).

사용: KIE_AI_API_KEY=... python3 tools/kie-gen.py --prompt-file P.txt --out OUT.png \
        [--aspect 16:9] [--resolution 1K|2K|4K] [--background transparent|opaque|auto]
- background는 1K에서만 된다(KIE 제약). 2K 투명 그림은 마젠타 배경으로 만든 뒤 sprite-gen cutout으로 지운다.
- 결과 옆에 OUT.json(요청, taskId, 소요 크레딧)을 남긴다.
"""
import argparse, json, os, ssl, sys, time, urllib.request

API = "https://api.kie.ai/api/v1/jobs"
MODEL = "gpt-image-2-5-flare-text-to-image"


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


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--prompt-file", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--aspect", default="1:1")
    p.add_argument("--resolution", default="1K", choices=["1K", "2K", "4K"])
    p.add_argument("--background", choices=["transparent", "opaque", "auto"])
    p.add_argument("--timeout", type=int, default=600)
    a = p.parse_args()
    key = os.environ.get("KIE_AI_API_KEY") or sys.exit("KIE_AI_API_KEY가 없습니다")
    prompt = open(a.prompt_file, encoding="utf-8").read().strip()
    inp = {"prompt": prompt, "aspect_ratio": a.aspect, "resolution": a.resolution}
    if a.background:
        if a.resolution != "1K":
            sys.exit("background는 1K에서만 쓸 수 있습니다")
        inp["background"] = a.background
    task = call("POST", f"{API}/createTask", key, {"model": MODEL, "input": inp})["taskId"]
    print(f"task {task}", flush=True)
    t0 = time.time()
    while True:
        time.sleep(5)
        d = call("GET", f"{API}/recordInfo?taskId={task}", key)
        if d["state"] == "success":
            break
        if d["state"] == "fail":
            sys.exit(f"실패: {d.get('failCode')} {d.get('failMsg')}")
        if time.time() - t0 > a.timeout:
            sys.exit(f"시간 초과 (taskId {task})")
    url = json.loads(d["resultJson"])["resultUrls"][0]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with urllib.request.urlopen(url, context=ctx(), timeout=120) as r, open(a.out, "wb") as f:
        f.write(r.read())
    rep = {"model": MODEL, "input": inp, "taskId": task, "credits": d.get("creditsConsumed"),
           "costTime": d.get("costTime"), "source_url": url}
    json.dump(rep, open(os.path.splitext(a.out)[0] + ".json", "w"), ensure_ascii=False, indent=1)
    print(f"saved {a.out} credits={d.get('creditsConsumed')}")


if __name__ == "__main__":
    main()
