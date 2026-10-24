import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition active:scale-95",
        active
          ? "border-accent bg-accent text-accent-fg font-semibold"
          : "border-line bg-surface text-muted hover:text-fg hover:border-accent",
        className,
      )}
      {...rest}
    />
  );
});
