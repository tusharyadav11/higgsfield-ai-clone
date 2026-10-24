import type { ReactNode } from "react";
import { cardCls } from "./ui";

/** Anchored settings card. `scroll-mt` clears the sticky workspace tabs + in-page nav. */
export function Section({ id, title, description, pills, children }: { id: string; title: string; description?: ReactNode; pills?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} data-testid={`section-${id}`} aria-labelledby={`${id}-h`} className={`${cardCls} scroll-mt-44 lg:scroll-mt-28`}>
      <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-1">
        <h2 id={`${id}-h`} className="min-w-0 text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">{pills}</div>
        {description && <p className="basis-full text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
