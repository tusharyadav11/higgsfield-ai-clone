"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, Clock, Zap, Compass, Cpu, Sparkles, Flame, CircleHelp, SearchX } from "lucide-react";
import { ACTIONS, ARTICLES, PAGES, TOOLS } from "@/lib/guide/kb";
import { scoreAny } from "@/lib/guide/fuzzy";
import { lsGet, lsSet, openGuide, useIsMac, type GuideEvent } from "@/lib/guide/bus";

type ModelRow = { id: string; name: string; kind: string; credits: number };
type PostRow = { id: string; title: string; prompt: string; model: string; tags?: string[]; remixes?: number };
type Item = { id: string; group: string; title: string; sub?: string; go: () => void };

const RECENT_KEY = "kinetic.recent.v1";
const GROUP_ORDER = ["Actions", "Pages", "Models", "Tools", "Trending prompts", "Help"];
const GROUP_ICON: Record<string, typeof Zap> = { Actions: Zap, Pages: Compass, Models: Cpu, Tools: Sparkles, "Trending prompts": Flame, Help: CircleHelp };
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
  const kbd = "rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] leading-none";
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-scrim sm:items-start sm:px-4 sm:pt-[min(10vh,6rem)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Kinetic"
        onKeyDown={onKey}
        className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-surface text-fg sm:h-auto sm:max-h-[min(640px,calc(100dvh-min(10vh,6rem)-1rem))] sm:w-[min(90vw,720px)] sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 transition-shadow focus-within:shadow-[inset_0_-2px_0_var(--accent)] max-sm:box-content max-sm:pt-[env(safe-area-inset-top)]">
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
            className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-base leading-none text-fg shadow-none outline-none ring-0 placeholder:text-muted focus:shadow-none focus:outline-none focus-visible:shadow-none focus-visible:outline-none"
          />
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close search" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-fg sm:size-auto sm:min-h-8 sm:px-0">
            <X className="size-5 sm:hidden" aria-hidden />
            <kbd className={`${kbd} hidden sm:inline`}>Esc</kbd>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {!q.trim() && recent.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Recent searches</p>
              <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setQ(r);
                      inputRef.current?.focus();
                    }}
                    className="flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-line px-3 text-sm text-muted hover:border-accent hover:text-fg"
                  >
                    <Clock className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{r}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul id="pal-list" ref={listRef} role="listbox" aria-label="Results">
            {items.map((it, i) => {
              const header = it.group !== lastGroup;
              lastGroup = it.group;
              const Icon = GROUP_ICON[it.group] ?? Search;
              return (
                <li key={`${it.group}-${it.id}`} role="presentation">
                  {header && <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">{!q.trim() && it.group === "Trending prompts" ? "Trending now" : it.group}</p>}
                  <div
                    id={`pal-opt-${i}`}
                    role="option"
                    aria-selected={i === clamped}
                    data-testid="search-result"
                    onMouseMove={() => i !== clamped && setActive(i)}
                    onClick={it.go}
                    className={`flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl p-3 ${i === clamped ? "bg-accent/15 shadow-[inset_0_0_0_1px_var(--accent)]" : ""}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent-text">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5">{it.title}</p>
                      {it.sub && <p className="truncate text-xs leading-4 text-muted">{it.sub}</p>}
                    </div>
                    <CornerDownLeft className={`size-4 shrink-0 text-muted ${i === clamped ? "" : "invisible"}`} aria-hidden />
                  </div>
                </li>
              );
            })}
          </ul>
          {q.trim() && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
              <SearchX className="size-8" aria-hidden />
              <p className="max-w-full break-words">Nothing found for &ldquo;{q}&rdquo;.</p>
              <button
                type="button"
                className="min-h-11 text-accent-text underline"
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
        <div className="hidden h-11 shrink-0 items-center justify-between gap-3 border-t border-line px-4 text-xs text-muted sm:flex">
          <span className="flex min-w-0 items-center gap-2 truncate">
            <kbd className={kbd}>↑↓</kbd> navigate <kbd className={kbd}>Enter</kbd> open <kbd className={kbd}>Esc</kbd> close
          </span>
          <span className="shrink-0">{mac ? "⌘K" : "Ctrl K"} anywhere</span>
        </div>
      </div>
    </div>
  );
}
