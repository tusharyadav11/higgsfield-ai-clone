"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Plain-language body: WHAT is removed, WHERE it is stored, whether it can be undone. */
  children: React.ReactNode;
  /** Verb label, e.g. "Delete 12 messages". */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE = "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** Accessible alertdialog with focus trap. Cancel is focused by default; Escape cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Keep it", onConfirm, onCancel }: ConfirmDialogProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);
  useEffect(() => {
    cancelFn.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
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
      cancelFn.current();
    } else if (e.key === "Tab") {
      const els = Array.from(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-scrim p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        data-testid="confirm-dialog"
        onKeyDown={onKey}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-bg text-danger">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <h2 id={`${id}-t`} className="pt-1.5 text-lg font-semibold leading-snug">
            {title}
          </h2>
        </div>
        <div id={`${id}-d`} className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          {children}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-cancel"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-line px-5 text-sm font-semibold text-fg hover:border-accent"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-ok"
            onClick={onConfirm}
            className="min-h-12 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
