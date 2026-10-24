"use client";
import { useState } from "react";
import { Archive, CheckCircle2, CircleDot, Eye, FileEdit, Image as ImageIcon, Video } from "lucide-react";
import { MediaView } from "@/components/features/media-view";
import { useStoreReady } from "@/lib/enterprise/persist";
import { useTeam } from "@/lib/enterprise/team-store";
import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { ACTOR, LIBRARY, STATUS_LABEL, getAsset, type Ctx, type LibAsset, type Status } from "@/lib/enterprise/projects-store";
import type { Role } from "@/lib/enterprise/roles";

const STATUS_STYLE: Record<Status, { cls: string; icon: React.ReactNode }> = {
  draft: { cls: "text-muted", icon: <FileEdit className="size-3" aria-hidden /> },
  in_review: { cls: "text-warn", icon: <Eye className="size-3" aria-hidden /> },
  approved: { cls: "text-success", icon: <CheckCircle2 className="size-3" aria-hidden /> },
  archived: { cls: "text-muted", icon: <Archive className="size-3" aria-hidden /> },
};

export function ProjectStatus({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span data-testid="project-status" data-status={status} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "Acting as" role from the team store (ENTERPRISE-B), rehydrated after mount. */
export function useActing() {
  const ready = useStoreReady(useTeam);
  const role = useTeam((s) => s.actingAs);
  const setRole = useTeam((s) => s.setActingAs);
  const ctx = (): Ctx => ({ actor: ACTOR, role, at: new Date().toISOString() });
  return { ready, role: role as Role, setRole, ctx };
}

/** One asset: still + motion preview via MediaView, filling a box of the given aspect. */
export function AssetTile({ asset, className = "", sizes, priority }: { asset: LibAsset; className?: string; sizes?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-surface-2", className)}>
      <MediaView kind={asset.kind} src={asset.src} poster={asset.poster} aspect={asset.aspect} alt={asset.title} blur={asset.blur} fillParent sizes={sizes ?? "(min-width:1024px) 20vw, 50vw"} priority={priority} />
    </div>
  );
}

export function AssetKindIcon({ kind }: { kind: "image" | "video" }) {
  return kind === "video" ? <Video className="size-3.5" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />;
}

export const assetOf = (id: string) => getAsset(id);

/** Selectable library grid (plain thumbnails, no motion: keeps 40+ tiles light). */
export function AssetPicker({ selected, onToggle, exclude = [], max }: { selected: string[]; onToggle: (id: string) => void; exclude?: string[]; max?: number }) {
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const items = LIBRARY.filter((a) => !exclude.includes(a.id) && (kind === "all" || a.kind === kind));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Filter library by type">
        {(["all", "image", "video"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full border px-4 text-sm ${kind === k ? "border-accent bg-accent text-accent-fg font-semibold" : "border-line bg-surface text-muted hover:text-fg"}`}>
            {k === "all" ? "All" : k === "image" ? "Images" : "Videos"}
          </button>
        ))}
        <span className="self-center text-xs text-muted">{selected.length} selected{max ? ` (max ${max})` : ""}</span>
      </div>
      <ul data-testid="asset-picker" className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {items.map((a) => {
          const on = selected.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${a.title} (${a.kind})`}
                data-testid="picker-asset"
                onClick={() => onToggle(a.id)}
                className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-surface-2 ${on ? "border-accent" : "border-transparent hover:border-line"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
              >
                <Image src={a.poster ?? a.src} alt="" fill sizes="96px" loading="lazy" className="object-cover" />
                <span className="absolute left-1 top-1 rounded-full bg-scrim px-1.5 py-0.5 text-[10px] text-white">{a.kind === "video" ? "Video" : "Image"}</span>
                {on && <CircleDot className="absolute bottom-1 right-1 size-5 rounded-full bg-accent text-accent-fg" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
