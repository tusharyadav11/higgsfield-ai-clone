import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface/90 p-4 shadow-[0_1px_0_rgb(255_255_255/0.04)_inset] sm:p-5", className)}
      {...rest}
    />
  );
}
