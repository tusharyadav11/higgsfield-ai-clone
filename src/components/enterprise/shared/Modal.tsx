"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Accessible modal: dialog (centered) or drawer (right side, full width on phones).
 * Focus moves in, Tab is trapped, Escape closes, focus returns to the opener, body scroll is locked.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  variant = "dialog",
  testId,
  children,
  footer,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: "dialog" | "drawer";
  testId?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeFn = useRef(onClose);
  useEffect(() => {
    closeFn.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = lock;
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (!box.current?.contains(e.target as Node)) return; // events bubbling from a nested portal (e.g. ConfirmDialog)
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeFn.current();
    } else if (e.key === "Tab") {
      const els = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const drawer = variant === "drawer";
  return createPortal(
    <div
      className={`fixed inset-0 z-[100] bg-scrim ${drawer ? "flex justify-end" : "grid place-items-center overflow-y-auto p-3 sm:p-4"}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
        data-testid={testId}
        onKeyDown={onKey}
        className={`flex flex-col bg-surface text-fg shadow-2xl ${
          drawer ? "h-dvh w-full max-w-full border-l border-line sm:max-w-2xl" : "max-h-[calc(100dvh-1.5rem)] w-full max-w-lg rounded-2xl border border-line sm:max-h-[calc(100dvh-2rem)]"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-line p-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-t`} className="break-words text-lg font-semibold leading-snug">
              {title}
            </h2>
            {description && (
              <p id={`${id}-d`} className="mt-0.5 text-sm text-muted">
                {description}
              </p>
            )}
            {headerExtra}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" data-testid="modal-close" className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
