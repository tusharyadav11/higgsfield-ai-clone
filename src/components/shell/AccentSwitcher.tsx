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
            setAccent(name);
            applyAccent(name);
          }}
          className="flex size-11 items-center justify-center max-[400px]:size-9"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-bg transition",
              accent === name ? "ring-2 ring-accent scale-110" : "ring-0 opacity-80 hover:opacity-100",
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
