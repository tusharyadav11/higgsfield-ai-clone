"use client";

import { MediaView } from "./media-view";
import Link from "next/link";
import { ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import { getModel } from "@/lib/models";
import { useStore } from "@/lib/store";

export function LibraryView() {
  const library = useStore((s) => s.library);
  const remove = useStore((s) => s.removeFromLibrary);

  if (library.length === 0) {
    return (
      <div
        data-testid="library-empty"
        className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-20 text-center"
      >
        <div className="grid size-14 place-items-center rounded-2xl bg-surface text-accent">
          <ImageIcon size={26} />
        </div>
        <h2 className="text-lg font-semibold text-fg">Nothing saved yet</h2>
        <p className="max-w-sm text-sm text-muted">Everything you generate lands here automatically. Make your first one in seconds.</p>
        <Link href="/create" className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
          Start creating
        </Link>
      </div>
    );
  }
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {library.map((it) => {
        const qs = new URLSearchParams({ prompt: it.prompt, model: it.model });
        return (
          <article
            key={it.id}
            data-testid="library-item"
            className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface"
          >
            <MediaView kind={it.kind} src={it.url} poster={it.poster} aspect={it.aspect} alt={it.prompt} />
            <div className="space-y-2 p-3">
              <p className="line-clamp-2 text-xs text-muted">{it.prompt}</p>
              <p className="text-xs text-muted">{getModel(it.model)?.name ?? it.model}</p>
              <div className="flex items-center justify-between">
                <Link
                  href={`/create?${qs}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg"
                >
                  <RefreshCw size={14} /> Re-run
                </Link>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => remove(it.id)}
                  className="grid size-11 place-items-center rounded-full text-muted hover:text-fg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
