# Capture test

**Tool / model:** Claude Code 2.1.308 (VS Code extension + CLI), `claude-sonnet-5-5` for both planning and execution (single model).

**Mechanism:** Claude Code hooks in [.claude/settings.json](.claude/settings.json): `UserPromptSubmit` and `Stop` both run [.claude/hooks/capture.py](.claude/hooks/capture.py). The prompt hook logs the prompt verbatim from the hook payload. The stop hook reads `transcript_path`, backfills any turns it hasn't logged, and appends the final response (text after the turn's last tool call). It is append-only apart from the file header. Failures go to `.agent-logs/_capture-errors.log` and never block the session.

**Log file the canary landed in:** `.agent-logs/2026-10-24_06-03-15_57486633-1f07-41aa-bb61-aab56ad86e9c.md`

**Canary, session 2 (fresh headless `claude -p` session), raw:**

```
[LOG_ENTRY type=PROMPT num=1 session=57486633]
timestamp: 2026-10-24T06:03:15.064Z
model: claude-sonnet-5-5

CAPTURE TEST — 8x assignment, Tushar Yadav (headless session)


[LOG_ENTRY type=RESPONSE num=1 session=57486633]
timestamp: 2026-10-24T06:03:17.694Z
model: claude-sonnet-5-5

Capture test received. The session is up and nothing is pending, so I haven't run any tools or changed anything.

Send me the actual task when you're ready.
```

**Canary, session 1 (the interactive VS Code session):** pending. The hooks were installed mid-session, so they take effect from the next prompt there. The entry will be pasted below once it lands.

**Tried first / notes:**
- Dry-run of the script against this session's real transcript parsed prompts and final responses correctly. I deleted that dry-run log, since it wasn't a real hook firing.
- Turns before the hook was installed (the assignment brief and the setup steps) are not in the log. They're in the transcript only.
