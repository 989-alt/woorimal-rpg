#!/usr/bin/env python3
"""KIE.AI GPT Image 2.5로 그림 한 장을 만든다 (구독 한도에 닿았을 때 쓰는 대체 경로, 호출당 과금).

사용: KIE_AI_API_KEY=... python3 tools/kie-gen.py --prompt-file P.txt --out OUT.png \
        [--aspect 16:9] [--resolution 1K|2K|4K] [--background transparent|opaque|auto] \
        [--ref PATH ...]
- --ref(여러 번 가능)를 주면 파일을 KIE에 올려 image-to-image 모델로 만든다. 없으면 text-to-image.
- background는 1K에서만 된다(KIE 제약). 2K 투명 그림은 마젠타 배경으로 만든 뒤 sprite-gen cutout으로 지운다.
- 결과 옆에 OUT.json(요청, taskId, 소요 크레딧)을 남긴다.
- --ledger L --task T --cap N: 크레딧 장부(탭 구분 taskId label out resolution credits status).
  키 확인보다 먼저 장부 합계 + 예상(1K 6, 2K 10, 4K 20)이 N을 넘으면 종료 코드 3으로 멈춘다.
  작업을 만들면 pending 줄(예상값)을 더하고, 성공하면 실제 크레딧과 ok로, 실패·시간 초과면 fail(예상값 유지)로 고친다.
  합계는 상태와 상관없이 모든 줄을 더한다(실패도 예상값만큼 센다: 상한을 넉넉히 지키려고).
"""
import argparse, json, mimetypes, os, ssl, sys, time, urllib.error, urllib.request, uuid

API = "https://api.kie.ai/api/v1/jobs"
MODEL = "gpt-image-2-5-flare-text-to-image"
MODEL_I2I = "gpt-image-2-5-flare-image-to-image"
UPLOAD_URLS = ["https://kieai.redpandaai.co/api/file-stream-upload", "https://api.kie.ai/api/file-stream-upload"]


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


def multipart(fields, fname, content):
    b = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    mime = mimetypes.guess_type(fname)[0] or "application/octet-stream"
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\n'
                 f'Content-Type: {mime}\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={b}"


def upload(path, key):
    """파일을 KIE에 올리고 downloadUrl을 돌려준다. 첫 주소가 실패하면 두 번째로 한 번 더 시도한다."""
    content = open(path, "rb").read()
    body, ctype = multipart({"uploadPath": "woorimal"}, os.path.basename(path), content)
    err = None
    for url in UPLOAD_URLS:
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": ctype})
        try:
            with urllib.request.urlopen(req, context=ctx(), timeout=120) as r:
                out = json.load(r)
            if out.get("success") or out.get("code") == 200:
                return out["data"]["downloadUrl"]
            err = f"{out.get('code')}: {out.get('msg')}"
        except (urllib.error.URLError, ValueError, KeyError) as e:
            err = str(e)
        print(f"업로드 실패 ({url}): {err}", file=sys.stderr)
    sys.exit(f"업로드 실패: {err}")


EST = {"1K": 6, "2K": 10, "4K": 20}
HEADER = ["taskId", "label", "out", "resolution", "credits", "status"]


def ledger_rows(path):
    if not os.path.exists(path):
        return []
    lines = [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8") if l.strip()]
    return [r for r in lines if r and r[0] != "taskId"]


def ledger_total(rows, label=None):
    return sum(float(r[4]) for r in rows if len(r) > 4 and (label is None or r[1] == label))


def ledger_write(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        f.write("\t".join(HEADER) + "\n")
        for r in rows:
            f.write("\t".join(str(v) for v in r) + "\n")


def ledger_set(path, task, credits, status):
    rows = ledger_rows(path)
    for r in rows:
        if r[0] == task:
            r[4], r[5] = fmt(credits), status
    ledger_write(path, rows)


def fmt(v):
    v = float(v)
    return str(int(v)) if v == int(v) else str(v)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--prompt-file", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--aspect", default="1:1")
    p.add_argument("--resolution", default="1K", choices=["1K", "2K", "4K"])
    p.add_argument("--background", choices=["transparent", "opaque", "auto"])
    p.add_argument("--ref", action="append", default=[], help="참고 그림 파일 (여러 번 가능)")
    p.add_argument("--timeout", type=int, default=600)
    p.add_argument("--ledger", help="크레딧 장부 TSV")
    p.add_argument("--task", help="장부에 적을 이름(예: T1)")
    p.add_argument("--cap", type=float, help="장부 합계 상한")
    a = p.parse_args()
    est = EST[a.resolution]
    if a.ledger:
        if not a.task:
            sys.exit("--ledger에는 --task가 필요합니다")
        total = ledger_total(ledger_rows(a.ledger))
        if a.cap is not None and total + est > a.cap:
            print(f"크레딧 상한: 장부 합계 {fmt(total)} + 예상 {est} > {fmt(a.cap)}", file=sys.stderr)
            sys.exit(3)
    key = os.environ.get("KIE_AI_API_KEY") or sys.exit("KIE_AI_API_KEY가 없습니다")
    prompt = open(a.prompt_file, encoding="utf-8").read().strip()
    inp = {"prompt": prompt, "aspect_ratio": a.aspect, "resolution": a.resolution}
    if a.background:
        if a.resolution != "1K":
            sys.exit("background는 1K에서만 쓸 수 있습니다")
        inp["background"] = a.background
    model = MODEL
    if a.ref:
        model = MODEL_I2I
        inp["input_urls"] = [upload(r, key) for r in a.ref]
    task = call("POST", f"{API}/createTask", key, {"model": model, "input": inp})["taskId"]
    print(f"task {task}", flush=True)
    if a.ledger:
        ledger_write(a.ledger, ledger_rows(a.ledger) + [[task, a.task, a.out, a.resolution, est, "pending"]])
    try:
        d = poll(task, key, a.timeout)
    except BaseException:
        if a.ledger:
            ledger_set(a.ledger, task, est, "fail")
            report(a)
        raise
    if a.ledger:
        ledger_set(a.ledger, task, d.get("creditsConsumed") or est, "ok")
    url = json.loads(d["resultJson"])["resultUrls"][0]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with urllib.request.urlopen(url, context=ctx(), timeout=120) as r, open(a.out, "wb") as f:
        f.write(r.read())
    rep = {"model": model, "input": inp, "refs": dict(zip(a.ref, inp.get("input_urls", []))), "taskId": task, "credits": d.get("creditsConsumed"),
           "costTime": d.get("costTime"), "source_url": url}
    json.dump(rep, open(os.path.splitext(a.out)[0] + ".json", "w"), ensure_ascii=False, indent=1)
    print(f"saved {a.out} credits={d.get('creditsConsumed')}")
    if a.ledger:
        report(a)


def poll(task, key, timeout):
    t0 = time.time()
    while True:
        time.sleep(5)
        d = call("GET", f"{API}/recordInfo?taskId={task}", key)
        if d["state"] == "success":
            return d
        if d["state"] == "fail":
            sys.exit(f"실패: {d.get('failCode')} {d.get('failMsg')}")
        if time.time() - t0 > timeout:
            sys.exit(f"시간 초과 (taskId {task})")


def report(a):
    rows = ledger_rows(a.ledger)
    cap = f" / {fmt(a.cap)}" if a.cap is not None else ""
    print(f"task {a.task} {fmt(ledger_total(rows, a.task))} · 합계 {fmt(ledger_total(rows))}{cap}", flush=True)


if __name__ == "__main__":
    main()
