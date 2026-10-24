"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, Clock } from "lucide-react";
import { ACTIONS, ARTICLES, PAGES, TOOLS } from "@/lib/guide/kb";
import { scoreAny } from "@/lib/guide/fuzzy";
import { lsGet, lsSet, openGuide, useIsMac, type GuideEvent } from "@/lib/guide/bus";

type ModelRow = { id: string; name: string; kind: string; credits: number };
type PostRow = { id: string; title: string; prompt: string; model: string; tags?: string[]; remixes?: number };
type Item = { id: string; group: string; title: string; sub?: string; go: () => void };

const RECENT_KEY = "kinetic.recent.v1";
const GROUP_ORDER = ["Actions", "Pages", "Models", "Tools", "Trending prompts", "Help"];
const LIMITS: Record<string, number> = { Actions: 4, Pages: 4, Models: 4, Tools: 3, "Trending prompts": 5, Help: 3 };

export function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const mac = useIsMac();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      setRecent(lsGet<string[]>(RECENT_KEY, []));
      inputRef.current?.focus();
    }, 0);
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let live = true;
    fetch("/api/models").then((r) => r.json()).then((d) => live && Array.isArray(d) && setModels(d)).catch(() => {});
    fetch("/api/feed?limit=24").then((r) => r.json()).then((d) => live && Array.isArray(d?.items) && setPosts(d.items)).catch(() => {});
    return () => {
      live = false;
      clearTimeout(t);
      document.body.style.overflow = lock;
      prevFocus?.focus?.();
    };
  }, []);

  const finish = (fn: () => void) => {
    const term = q.trim();
    if (term) lsSet(RECENT_KEY, [term, ...recent.filter((r) => r !== term)].slice(0, 5));
    onClose();
    fn();
  };
  const runEvent = (k: GuideEvent) => setTimeout(() => openGuide(k), 60);
  const push = (href: string) => router.push(href);

  const items = useMemo<Item[]>(() => {
    const term = q.trim();
    const out: Item[] = [];
    const add = (group: string, id: string, title: string, sub: string | undefined, texts: string[], go: () => void, boost = 1) => {
      const s = scoreAny(term, texts) * boost;
      if (s > 0) out.push({ id, group, title, sub, go, ...({ s } as object) } as Item);
    };
    ACTIONS.forEach((a) =>
      add("Actions", a.id, a.title, a.blurb, [a.title, ...a.keywords], () => {
        if (a.href) finish(() => push(a.href!));
        else if (a.run) finish(() => runEvent(a.run === "assistant" ? "assistant" : (a.run as GuideEvent)));
      }),
    );
    PAGES.forEach((p) => add("Pages", p.id, p.title, p.blurb, [p.title, ...p.keywords], () => finish(() => push(p.href))));
    models.forEach((m) =>
      add("Models", m.id, m.name, `${m.kind} · ${m.credits} credits`, [m.name, m.kind, m.id], () => finish(() => push(`/create?model=${encodeURIComponent(m.id)}`))),
    );
    TOOLS.forEach((p) => add("Tools", p.id, p.title, p.blurb, [p.title, ...p.keywords], () => finish(() => push(p.href))));
    posts.forEach((p) =>
      add("Trending prompts", p.id, p.title || p.prompt.slice(0, 40), p.prompt, [p.prompt, p.title, ...(p.tags ?? [])], () =>
        finish(() => push(`/create?prompt=${encodeURIComponent(p.prompt.slice(0, 500))}&model=${encodeURIComponent(p.model)}`)),
      ),
    );
    ARTICLES.forEach((a) =>
      add("Help", a.id, a.title, a.body.slice(0, 90) + "...", [a.title, ...a.keywords, a.body], () => finish(() => (a.href ? push(a.href) : runEvent("assistant")))),
    );
    const byGroup = new Map<string, Item[]>();
    for (const it of out) {
      const arr = byGroup.get(it.group) ?? [];
      arr.push(it);
      byGroup.set(it.group, arr);
    }
    const res: Item[] = [];
    for (const g of GROUP_ORDER) {
      const arr = byGroup.get(g);
      if (!arr) continue;
      if (term) arr.sort((a, b) => (b as unknown as { s: number }).s - (a as unknown as { s: number }).s);
      res.push(...arr.slice(0, term ? LIMITS[g] : g === "Actions" ? 4 : g === "Trending prompts" ? 3 : g === "Pages" ? 5 : 0));
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, models, posts, recent]);

  const clamped = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => {
    listRef.current?.querySelector(`#pal-opt-${clamped}`)?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((clamped + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((clamped - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter" && e.target === inputRef.current) {
      e.preventDefault();
      items[clamped]?.go();
    } else if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === inputRef.current ? closeRef.current : inputRef.current)?.focus();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/60 sm:items-start sm:px-4 sm:pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Kinetic"
        onKeyDown={onKey}
        className="flex h-dvh w-full flex-col bg-surface text-fg sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 pt-safe">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            data-testid="search-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `pal-opt-${clamped}` : undefined}
            aria-label="Search pages, models, prompts and help"
            placeholder="Search pages, models, prompts, help..."
            autoComplete="off"
            spellCheck={false}
            className="min-h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close search" className="grid size-11 place-items-center rounded-lg text-muted hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!q.trim() && recent.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">Recent searches</p>
              <div className="flex flex-wrap gap-1.5 px-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setQ(r);
                      inputRef.current?.focus();
                    }}
                    className="flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-sm text-muted hover:border-accent hover:text-fg"
                  >
                    <Clock className="size-3" aria-hidden /> {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul id="pal-list" ref={listRef} role="listbox" aria-label="Results">
            {items.map((it, i) => {
              const header = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <li key={`${it.group}-${it.id}`} role="presentation">
                  {header && <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">{!q.trim() && it.group === "Trending prompts" ? "Trending now" : it.group}</p>}
                  <div
                    id={`pal-opt-${i}`}
                    role="option"
                    aria-selected={i === clamped}
                    data-testid="search-result"
                    onMouseMove={() => i !== clamped && setActive(i)}
                    onClick={it.go}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${i === clamped ? "bg-accent/15 ring-1 ring-accent" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.title}</p>
                      {it.sub && <p className="truncate text-xs text-muted">{it.sub}</p>}
                    </div>
                    {i === clamped && <CornerDownLeft className="size-4 shrink-0 text-muted" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
          {q.trim() && items.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted">
              Nothing found for &ldquo;{q}&rdquo;.{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => {
                  onClose();
                  runEvent("assistant");
                }}
              >
                Ask the assistant
              </button>
            </div>
          )}
        </div>
        <div className="hidden items-center justify-between border-t border-line px-3 py-2 text-xs text-muted sm:flex">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>{mac ? "⌘K" : "Ctrl K"} anywhere</span>
        </div>
      </div>
    </div>
  );
}
