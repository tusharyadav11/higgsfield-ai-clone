"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** Small accessible dialog (non-destructive content). Escape closes, focus is trapped and restored. */
export function Modal({ open, title, onClose, children, testid }: { open: boolean; title: string; onClose: () => void; children: ReactNode; testid?: string }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.body.style.overflow = lock;
      prev?.focus?.();
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close.current();
    } else if (e.key === "Tab") {
      const els = Array.from(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-scrim p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} data-testid={testid} onKeyDown={onKey} className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-4 text-fg shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          <button type="button" data-autofocus onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
