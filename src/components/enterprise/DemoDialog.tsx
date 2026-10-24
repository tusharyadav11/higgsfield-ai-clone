"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CalcState, Estimate } from "@/lib/enterprise/pricing";
import { RequestForm } from "./RequestForm";

/** Book-a-demo dialog (native <dialog>: focus trap, Esc, and focus restore come from the platform). */
export function DemoDialog({ open, onClose, est, calc }: { open: boolean; onClose: () => void; est: Estimate; calc: CalcState }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-testid="demo-dialog"
      aria-labelledby="demo-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(40rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-fg shadow-[0_40px_80px_-30px_var(--shadow-c)] backdrop:bg-scrim backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="demo-title" className="text-2xl font-semibold tracking-tight">Book a demo</h2>
              <p className="mt-1 text-sm text-muted">Tell us when suits you. No calendar is connected, so this is a request, not a booking: a person would reply to you.</p>
            </div>
            <button type="button" data-testid="demo-close" aria-label="Close dialog" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-5">
            <RequestForm kind="demo" est={est} calc={calc} onClose={onClose} />
          </div>
        </div>
      )}
    </dialog>
  );
}
