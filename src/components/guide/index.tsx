"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Search, Compass, MessageCircle, Keyboard, Sparkles, X } from "lucide-react";
import { SHORTCUTS, WHATS_NEW } from "@/lib/guide/kb";
import { lsGet, lsSet, openGuide, useGuideEvents, useIsMac, type GuideEvent } from "@/lib/guide/bus";
import type { TourKey } from "@/lib/guide/tour";
import { Palette } from "./Palette";
import { Tour } from "./Tour";
import { Assistant } from "./Assistant";

const SEEN_KEY = "kinetic.tour.seen";

function InfoDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-lg text-muted hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GuideRoot() {
  const router = useRouter();
  const [search, setSearch] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [tour, setTour] = useState<TourKey | null>(null);
  const [info, setInfo] = useState<"shortcuts" | "whatsnew" | null>(null);
  const [toast, setToast] = useState<{ text: string; offer?: boolean } | null>(null);
  const tourRef = useRef(tour);
  useEffect(() => {
    tourRef.current = tour;
  });

  const startTour = useCallback((k: TourKey) => {
    lsSet(SEEN_KEY, "1");
    setToast(null);
    setSearch(false);
    setAssistant(false);
    setTour(k);
  }, []);

  useGuideEvents((k: GuideEvent) => {
    if (k === "search") setSearch(true);
    else if (k === "assistant") {
      setSearch(false);
      setAssistant(true);
    } else if (k === "tour") startTour("main");
    else if (k === "first-video") startTour("first-video");
    else if (k === "claim") startTour("claim");
    else if (k === "shortcuts" || k === "whatsnew") setInfo(k);
    else if (k === "invite") {
      const url = window.location.origin;
      const done = () => setToast({ text: "Invite link copied. Share it with a friend!" });
      navigator.clipboard?.writeText(url).then(done, () => setToast({ text: `Share this link: ${url}` }));
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // One-time, non-blocking tour offer on first visit.
  useEffect(() => {
    const t = setTimeout(() => {
      if (lsGet<string | null>(SEEN_KEY, null) || tourRef.current) return;
      setToast({ text: "New here? Take a 30-second tour.", offer: true });
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!toast || toast.offer) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeAssistant = useCallback(() => setAssistant(false), []);
  const endTour = useCallback(
    (finished: boolean) => {
      setTour(null);
      if (finished && tourRef.current === "main") router.push("/");
    },
    [router],
  );

  return (
    <>
      {search && <Palette onClose={() => setSearch(false)} />}
      {tour && <Tour key={tour} tourKey={tour} onEnd={endTour} />}
      <Assistant open={assistant} onToggle={() => setAssistant((a) => !a)} onClose={closeAssistant} />
      {toast && (
        <div role="status" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-50 flex max-w-[calc(100vw-6rem)] items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 text-sm text-fg shadow-xl sm:bottom-5 sm:left-auto sm:right-24 sm:max-w-sm">
          <span>{toast.text}</span>
          {toast.offer && (
            <>
              <button type="button" data-testid="tour-start" onClick={() => startTour("main")} className="min-h-11 shrink-0 rounded-xl bg-accent px-3 font-semibold text-accent-fg">
                Start
              </button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  lsSet(SEEN_KEY, "1");
                  setToast(null);
                }}
                className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
      {info === "shortcuts" && (
        <InfoDialog title="Keyboard shortcuts" onClose={() => setInfo(null)}>
          <ul className="space-y-2 text-sm">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span>{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-xs">
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </InfoDialog>
      )}
      {info === "whatsnew" && (
        <InfoDialog title="What's new" onClose={() => setInfo(null)}>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            {WHATS_NEW.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </InfoDialog>
      )}
    </>
  );
}

export function SearchTrigger() {
  const mac = useIsMac();
  return (
    <button
      type="button"
      data-testid="search-trigger"
      onClick={() => openGuide("search")}
      aria-label="Search"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex size-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm text-muted hover:border-accent hover:text-fg sm:w-auto sm:min-w-11 sm:justify-start sm:px-3 lg:w-64"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="hidden flex-1 text-left sm:inline">Search...</span>
      <kbd className="hidden rounded border border-line px-1.5 text-[11px] lg:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const mac = useIsMac();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const items: { id: string; label: string; icon: typeof Search; ev: GuideEvent; hint?: string }[] = [
    { id: "tour-start", label: "Take the tour", icon: Compass, ev: "tour" },
    { id: "help-assistant", label: "Ask the assistant", icon: MessageCircle, ev: "assistant" },
    { id: "help-search", label: "Search", icon: Search, ev: "search", hint: mac ? "⌘K" : "Ctrl K" },
    { id: "help-shortcuts", label: "Keyboard shortcuts", icon: Keyboard, ev: "shortcuts" },
    { id: "help-new", label: "What's new", icon: Sparkles, ev: "whatsnew" },
  ];
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        data-testid="help-menu"
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full text-muted hover:text-fg"
      >
        <HelpCircle className="size-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Help" className="absolute right-0 top-full z-50 mt-1 w-60 rounded-2xl border border-line bg-surface p-1 shadow-2xl">
          {items.map(({ id, label, icon: Icon, ev, hint }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              data-testid={id}
              onClick={() => {
                setOpen(false);
                setTimeout(() => openGuide(ev), 0);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-fg hover:bg-surface-2"
            >
              <Icon className="size-4 text-accent" aria-hidden />
              <span className="flex-1">{label}</span>
              {hint && <span className="text-xs text-muted">{hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
