"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Search, Compass, PlayCircle, MessageCircle, Keyboard, Sparkles, X } from "lucide-react";
import { SHORTCUTS, WHATS_NEW } from "@/lib/guide/kb";
import { TOUR_VIDEO_EVENT, lsGet, lsSet, openGuide, useGuideEvents, useIsMac, type GuideEvent } from "@/lib/guide/bus";
import type { TourKey } from "@/lib/guide/tour";
import { ToastHost } from "@/components/ui/Toast";
import { Palette } from "./Palette";
import { Tour } from "./Tour";
import { Assistant } from "./Assistant";
import { TourVideo } from "./TourVideo";

const SEEN_KEY = "kinetic.tour.seen";
const OFFER_MS = 20_000;

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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-scrim p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-lg text-muted hover:text-fg">
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
  const [video, setVideo] = useState(false);
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
    setVideo(false);
    setTour(k);
  }, []);

  useEffect(() => {
    const open = () => {
      lsSet(SEEN_KEY, "1");
      setToast(null);
      setSearch(false);
      setAssistant(false);
      setVideo(true);
    };
    window.addEventListener(TOUR_VIDEO_EVENT, open);
    return () => window.removeEventListener(TOUR_VIDEO_EVENT, open);
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

  // One-time, non-blocking tour offer on first visit. It never shares the screen with an engage popup (src/components/engage):
  // the offer waits while a popup card is up, and while the offer is visible the engage engine counts it as an overlay and
  // holds its own popups back. The offer expires after OFFER_MS (and is then marked seen) so it cannot starve popups forever.
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      const tryShow = () => {
        if (lsGet<string | null>(SEEN_KEY, null)) return true;
        if (tourRef.current || document.querySelector('[data-testid="popup-card"]')) return false;
        setToast({ text: "New here? Watch the 60-second tour.", offer: true });
        return true;
      };
      if (!tryShow()) poll = setInterval(() => tryShow() && clearInterval(poll), 500);
    }, 2500);
    return () => {
      clearTimeout(t);
      clearInterval(poll);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => {
        if (toast.offer) lsSet(SEEN_KEY, "1");
        setToast(null);
      },
      toast.offer ? OFFER_MS : 4000,
    );
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
      {video && (
        <TourVideo
          onClose={() => setVideo(false)}
          onTry={() => {
            setVideo(false);
            setTimeout(() => startTour("main"), 0);
          }}
        />
      )}
      {tour && <Tour key={tour} tourKey={tour} onEnd={endTour} />}
      <ToastHost />
      <Assistant open={assistant} onToggle={() => setAssistant((a) => !a)} onClose={closeAssistant} />
      {toast && (
        <div role="status" data-testid={toast.offer ? "tour-offer" : undefined} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-50 flex max-w-[calc(100vw-6rem)] items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 text-sm text-fg shadow-xl sm:bottom-5 sm:left-auto sm:right-24 sm:max-w-sm">
          <span>{toast.text}</span>
          {toast.offer && (
            <>
              <button type="button" data-testid="tour-start" onClick={() => openGuide("tour-video")} className="min-h-11 shrink-0 rounded-xl bg-accent px-3 font-semibold text-accent-fg">
                Watch 60s tour
              </button>
              <button
                type="button"
                onClick={() => {
                  lsSet(SEEN_KEY, "1");
                  setToast(null);
                }}
                className="min-h-11 shrink-0 rounded-xl px-3 text-muted hover:text-fg"
              >
                Skip
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
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm text-muted transition-colors hover:border-accent hover:text-fg sm:size-auto sm:h-11 sm:min-w-0 sm:max-w-[640px] sm:flex-1 sm:justify-start sm:gap-2.5 sm:px-4"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">Search pages, models, prompts...</span>
      <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] leading-none md:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}

/** `placement="up-start"`: opens above the button, left-aligned (used inside the phone More sheet, near the bottom-left of the screen). */
export function HelpMenu({ placement = "down-end" }: { placement?: "down-end" | "up-start" }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
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
    { id: "help-tour-video", label: "Watch the 60-second tour", icon: PlayCircle, ev: "tour-video" },
    { id: "tour-start", label: "Take the interactive tour", icon: Compass, ev: "tour" },
    { id: "help-assistant", label: "Ask the assistant", icon: MessageCircle, ev: "assistant" },
    { id: "help-search", label: "Search", icon: Search, ev: "search", hint: mac ? "⌘K" : "Ctrl K" },
    { id: "help-shortcuts", label: "Keyboard shortcuts", icon: Keyboard, ev: "shortcuts" },
    { id: "help-new", label: "What's new", icon: Sparkles, ev: "whatsnew" },
  ];
  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
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
        <div role="menu" aria-label="Help" className={`absolute z-50 w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-surface p-1 shadow-2xl ${placement === "up-start" ? "bottom-full left-0 mb-1" : "right-0 top-full mt-1"}`}>
          {items.map(({ id, label, icon: Icon, ev, hint }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              data-testid={id}
              onClick={() => {
                trigger.current?.focus(); // so dialogs opened from here can return focus to the Help button
                setOpen(false);
                setTimeout(() => openGuide(ev), 0);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-fg hover:bg-surface-2"
            >
              <Icon className="size-4 text-accent-text" aria-hidden />
              <span className="flex-1">{label}</span>
              {hint && <span className="text-xs text-muted">{hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
