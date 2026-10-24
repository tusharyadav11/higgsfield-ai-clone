#!/usr/bin/env python3
"""Append-only prompt/final-response capture for Claude Code.

Usage: capture.py prompt|stop   (hook JSON on stdin)
Writes .agent-logs/YYYY-MM-DD_HH-MM-SS_<session>.md in the 8x format.
The transcript is used only to backfill turns the hooks never saw and to get
the final response; nothing already in the log is rewritten (only the header).
"""
import glob, json, os, re, sys, time
from datetime import datetime, timezone

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
LOGDIR = os.path.join(ROOT, ".agent-logs")
TOOL = "claude-code"
DEFAULT_MODEL = "claude-sonnet-5-5"
ENTRY = re.compile(r"^\[LOG_ENTRY type=(PROMPT|RESPONSE) num=(\d+) session=\S+\]$", re.M)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def text_of(content):
    if isinstance(content, str):
        return content
    return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def read_turns(path):
    """[{prompt, pts, response, rts, model}] from the transcript; response is the
    text after the turn's last tool call (the final answer), None if not there yet."""
    turns, model = [], DEFAULT_MODEL
    if not path or not os.path.exists(path):
        return turns
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            msg = e.get("message") or {}
            c = msg.get("content")
            if e.get("type") == "user" and c is not None and not e.get("isMeta"):
                if isinstance(c, list) and any(b.get("type") == "tool_result" for b in c if isinstance(b, dict)):
                    continue
                t = text_of(c).strip("\n")
                if t.strip():
                    turns.append({"prompt": t, "pts": e.get("timestamp"), "response": None, "rts": None, "model": model, "_seg": []})
            elif e.get("type") == "assistant" and turns and isinstance(c, list):
                model = msg.get("model") or model
                t = turns[-1]
                t["model"] = model
                for b in c:
                    if b.get("type") == "tool_use":
                        t["_seg"] = []
                    elif b.get("type") == "text" and b.get("text", "").strip():
                        t["_seg"].append(b["text"])
                        t["rts"] = e.get("timestamp")
    for t in turns:
        t["response"] = "\n\n".join(t.pop("_seg")) or None
    return turns


def session_file(sid, first_ts):
    hits = glob.glob(os.path.join(LOGDIR, f"*_{sid}.md"))
    if hits:
        return hits[0]
    d = datetime.fromisoformat((first_ts or now()).replace("Z", "+00:00"))
    return os.path.join(LOGDIR, f"{d.strftime('%Y-%m-%d_%H-%M-%S')}_{sid}.md")


def entry(kind, num, sid, ts, model, body):
    return f"[LOG_ENTRY type={kind} num={num} session={sid[:8]}]\ntimestamp: {ts}\nmodel: {model}\n\n{body}\n\n\n"


def header(sid, author, model, body):
    ents = ENTRY.findall(body)
    prompts = sum(1 for k, _ in ents if k == "PROMPT")
    ts = re.findall(r"type=PROMPT num=\d+ session=\S+\]\ntimestamp: (\S+)", body)
    date = (ts[0] if ts else now())[:10]
    return (f"---\nsession_id: {sid}\ndate: {date}\nauthor: {author}\nmodel: {model}\ntool: {TOOL}\n"
            f"project: {os.path.basename(ROOT.rstrip('/')).strip() or 'project'}\ntotal_exchanges: {prompts}\n"
            f"first_prompt_time: {ts[0] if ts else ''}\nlast_prompt_time: {ts[-1] if ts else ''}\n---\n\n"
            f"# Session Log - {date}\n\nSession: `{sid[:8]}` | Author: `{author}`\n\n---\n\n")


def author():
    return os.environ.get("AGENT_LOG_AUTHOR") or "tusharyadav11"


def main():
    mode = sys.argv[1]
    p = json.load(sys.stdin)
    sid = p.get("session_id", "unknown")
    turns = read_turns(p.get("transcript_path"))
    cur = p.get("prompt") if mode == "prompt" else None
    if cur is not None and turns and turns[-1]["prompt"].strip() == cur.strip():
        turns.pop()  # logged below straight from the hook payload
    os.makedirs(LOGDIR, exist_ok=True)
    path = session_file(sid, (turns[0]["pts"] if turns else None))
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    body = old[old.index("[LOG_ENTRY"):] if "[LOG_ENTRY" in old else ""
    have = {(k, int(n)) for k, n in ENTRY.findall(body)}
    new, model = "", DEFAULT_MODEL
    for i, t in enumerate(turns, 1):
        model = t["model"]
        if ("PROMPT", i) not in have:
            new += entry("PROMPT", i, sid, t["pts"] or now(), model, t["prompt"])
        if t["response"] and ("RESPONSE", i) not in have:
            new += entry("RESPONSE", i, sid, t["rts"] or now(), model, t["response"])
    if mode == "stop":
        last = p.get("last_assistant_message")
        n = len(turns)
        if n and not turns[-1]["response"] and last and ("RESPONSE", n) not in have:
            new += entry("RESPONSE", n, sid, now(), model, last)
    if cur is not None:
        n = len(turns) + 1
        if ("PROMPT", n) not in have:
            new += entry("PROMPT", n, sid, now(), model, cur)
    full = body + new
    if not new and old:
        return
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        f.write(header(sid, author(), model, full) + full)
    os.replace(path + ".tmp", path)


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:  # never block the session
        os.makedirs(LOGDIR, exist_ok=True)
        with open(os.path.join(LOGDIR, "_capture-errors.log"), "a") as f:
            f.write(f"{now()} {sys.argv[1:]} {ex!r}\n")
