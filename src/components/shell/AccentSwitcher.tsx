"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { ACCENTS, ACCENT_SWATCH, applyAccent, type Accent } from "@/lib/theme";
import { cn } from "@/components/ui/cn";

export function AccentSwitcher({ initial }: { initial: Accent }) {
  const [accent, setAccent] = useState<Accent>(initial);
  return (
    <div
      data-testid="accent-switcher"
      role="radiogroup"
      aria-label="Accent colour"
      className="flex items-center"
    >
      {ACCENTS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={accent === name}
          aria-label={`${name} accent`}
          data-testid={`accent-option-${name}`}
          onClick={() => {
            const root = document.documentElement;
            if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              root.classList.add("accent-fade");
              window.setTimeout(() => root.classList.remove("accent-fade"), 520);
            }
            setAccent(name);
            applyAccent(name);
          }}
          className="flex size-11 items-center justify-center"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-bg transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(.3,1.6,.5,1)]",
              accent === name ? "ring-2 ring-accent scale-110 shadow-[0_0_16px_-2px_var(--glow)]" : "ring-0 opacity-80 hover:opacity-100",
            )}
            style={{ background: ACCENT_SWATCH[name] }}
          >
            {accent === name && <Check className="size-3.5 text-black" strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}
