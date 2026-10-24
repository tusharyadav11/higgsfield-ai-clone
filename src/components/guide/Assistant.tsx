"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Trash2, X, RotateCcw } from "lucide-react";
import { SUGGESTIONS } from "@/lib/guide/kb";
import type { AssistLink } from "@/lib/guide/assist";
import { lsGet, lsSet, openGuide } from "@/lib/guide/bus";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Msg = { id: string; role: "user" | "assistant"; text: string; links?: AssistLink[]; mode?: "ai" | "builtin"; error?: boolean };
const KEY = "kinetic.assist.v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const modeLabel = (m?: "ai" | "builtin") => (m === "ai" ? "AI answer (Claude)" : m === "builtin" ? "Built-in help (no AI model)" : null);

export function Assistant({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const askRef = useRef(false);
  useEffect(() => {
    askRef.current = askClear;
  });
  const loaded = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setMsgs(lsGet<Msg[]>(KEY, []).filter((m) => !m.error));
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (loaded.current && !busy) lsSet(KEY, msgs.slice(-30));
  }, [msgs, busy]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !askRef.current && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: string, p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const ask = async (question: string, history: Msg[]) => {
    const q = question.trim().slice(0, 500);
    if (!q || busy) return;
    const aid = uid();
    const userMsg: Msg = { id: uid(), role: "user", text: q };
    setMsgs([...history, userMsg, { id: aid, role: "assistant", text: "" }]);
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const payload = [...history, userMsg].filter((m) => m.text && !m.error).slice(-8).map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch("/api/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: payload }), signal: ctl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Request failed");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 2);
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.t === "delta") {
            acc += ev.text;
            patch(aid, { text: acc });
          } else if (ev.t === "done") patch(aid, { links: ev.links, mode: ev.mode });
          else if (ev.t === "error") throw new Error(ev.message);
        }
      }
    } catch (e) {
      if (ctl.signal.aborted) return;
      patch(aid, { text: e instanceof Error && e.message ? e.message : "Something went wrong.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const send = (v = text) => {
    setText("");
    void ask(v, msgs.filter((m) => !(m.error && m.role === "assistant")));
  };
  const retry = () => {
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = msgs.lastIndexOf(lastUser);
    void ask(lastUser.text, msgs.slice(0, idx));
  };
  const clear = () => {
    abort.current?.abort();
    setBusy(false);
    setMsgs([]);
    lsSet(KEY, []);
    setAskClear(false);
  };
  const follow = (l: AssistLink) => {
    if (l.href) {
      router.push(l.href);
      onClose();
    } else if (l.run) {
      onClose();
      setTimeout(() => openGuide(l.run === "tour" ? "tour" : l.run === "first-video" ? "first-video" : "claim"), 120);
    }
  };

  const lastMode = [...msgs].reverse().find((m) => m.mode)?.mode;
  const last = msgs[msgs.length - 1];

  return (
    <>
      <button
        type="button"
        data-testid="assistant-toggle"
        onClick={onToggle}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-50 grid size-12 place-items-center rounded-full bg-accent text-accent-fg shadow-lg ring-1 ring-black/20 transition hover:scale-105 sm:bottom-5 sm:right-5"
      >
        {open ? <X className="size-5" aria-hidden /> : <Bot className="size-6" aria-hidden />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="fixed inset-x-2 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 flex max-h-[min(34rem,calc(100dvh-10rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-5 sm:w-96 sm:max-h-[calc(100dvh-6rem)] [@media(max-height:500px)]:bottom-2 [@media(max-height:500px)]:right-20 [@media(max-height:500px)]:max-h-[calc(100dvh-1rem)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1">
            <h2 className="text-sm font-semibold">Ask Kinetic</h2>
            <div className="flex">
              {msgs.length > 0 && (
                <button type="button" data-testid="assistant-clear" onClick={() => setAskClear(true)} aria-label="Clear chat" title="Clear chat" className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:text-fg">
                  <Trash2 className="size-4" aria-hidden /> Clear chat
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close assistant" className="grid size-11 place-items-center rounded-lg text-muted hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm">New to AI creation? Ask me where things are or how to do something.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="min-h-11 max-w-full rounded-full border border-line px-3.5 py-2 text-left text-xs leading-snug hover:border-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  data-testid="assistant-msg"
                  data-role={m.role}
                  className={`max-w-[88%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-accent text-accent-fg" : m.error ? "border border-danger-line bg-danger-bg" : "bg-surface-2"}`}
                >
                  {m.text ? (
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  ) : (
                    <span className="inline-flex gap-1 py-1" role="status" aria-label="Assistant is typing">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
                      ))}
                    </span>
                  )}
                  {m.error && (
                    <button type="button" onClick={retry} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 text-xs">
                      <RotateCcw className="size-3" aria-hidden /> Retry
                    </button>
                  )}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <button key={l.label + (l.href ?? l.run)} type="button" onClick={() => follow(l)} className="min-h-11 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-fg">
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {modeLabel(m.mode) && <p className="mt-1 text-[10px] text-muted">{modeLabel(m.mode)}</p>}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-line p-2"
          >
            <input
              ref={inputRef}
              data-testid="assistant-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Where is… / How do I…"
              aria-label="Ask the assistant"
              className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" data-testid="assistant-send" disabled={busy || !text.trim()} aria-label="Send" className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg disabled:opacity-50">
              <Send className="size-4" aria-hidden />
            </button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-muted">
            {lastMode === "ai" ? "Powered by Claude AI. Answers may be imperfect." : lastMode === "builtin" ? "Built-in help: instant answers from the app guide, no AI model involved." : "Each reply says whether it is AI (Claude) or built-in help."}
            {last?.error ? "" : ""}
          </p>
        </div>
      )}
      <ConfirmDialog
        open={askClear}
        title="Clear this chat?"
        confirmLabel={`Delete ${msgs.length} message${msgs.length === 1 ? "" : "s"}`}
        cancelLabel="Keep chat"
        onConfirm={clear}
        onCancel={() => setAskClear(false)}
      >
        <p>
          This deletes the {msgs.length} message{msgs.length === 1 ? "" : "s"} in your chat with the Kinetic assistant. They&apos;re only saved on this device. This can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
