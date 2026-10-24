"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Layers, LayoutGrid, List, MessageSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DemoBadge } from "../shared/DemoBadge";
import { LocalTime } from "../shared/LocalTime";
import { fieldCls } from "../shared/ui";
import { useStoreReady } from "@/lib/enterprise/persist";
import { ROLES, ROLE_LABEL, isRole } from "@/lib/enterprise/roles";
import { STATUSES, STATUS_LABEL, allOwners, allTags, canEdit, currentAssets, getAsset, queryProjects, statusCounts, useProjects, type Project, type SortKey, type Status } from "@/lib/enterprise/projects-store";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectDrawer } from "./ProjectDrawer";
import { AssetTile, ProjectStatus, useActing } from "./parts";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "name", label: "Name (A to Z)" },
  { id: "status", label: "Status" },
];

export function ProjectsView() {
  const ready = useStoreReady(useProjects);
  const projects = useProjects((s) => s.projects);
  const resetDemo = useProjects((s) => s.resetDemo);
  const { ready: teamReady, role, setRole } = useActing();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const openId = sp.get("open");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);

  const setOpen = useCallback((id: string | null) => router.replace(id ? `${path}?open=${encodeURIComponent(id)}` : path, { scroll: false }), [router, path]);

  const list = useMemo(() => queryProjects(projects, { q, status, owner, tag, sort }), [projects, q, status, owner, tag, sort]);
  const counts = useMemo(() => statusCounts(projects, { q, owner, tag }), [projects, q, owner, tag]);
  const owners = useMemo(() => allOwners(projects), [projects]);
  const tags = useMemo(() => allTags(projects), [projects]);
  const open = projects.find((p) => p.id === openId) ?? null;
  const edit = canEdit(role);
  const filtered = q || status !== "all" || owner || tag;

  if (!ready || !teamReady) return <ProjectsSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            Projects & collaboration <DemoBadge label="Demo data" />
          </h2>
          <p className="mt-1 text-sm text-muted">
            Sample projects, assets from the local sample library and fictional teammates. Changes are saved in this browser only; nobody else sees them and nothing is sent to a server.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="acting-as" className="mb-1 block text-xs font-medium text-muted">Acting as (demo role)</label>
            <select id="acting-as" data-testid="acting-as" value={role} onChange={(e) => isRole(e.target.value) && setRole(e.target.value)} className={`${fieldCls} w-auto`}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <Button data-testid="create-project-btn" disabled={!edit} onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Create project
          </Button>
        </div>
      </div>
      {!edit && <p className="text-xs text-muted" data-testid="viewer-note">Creating projects is disabled: the Viewer role is read-only. Viewers can still open projects and comment.</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="proj-search" className="sr-only">Search projects</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="proj-search" data-testid="proj-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, owner, tag" className={`${fieldCls} pl-9`} />
        </div>
        <div>
          <label htmlFor="proj-owner" className="sr-only">Filter by owner</label>
          <select id="proj-owner" data-testid="proj-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${fieldCls} w-auto max-w-44`}>
            <option value="">All owners</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="proj-tag" className="sr-only">Filter by tag</label>
          <select id="proj-tag" data-testid="proj-tag" value={tag} onChange={(e) => setTag(e.target.value)} className={`${fieldCls} w-auto max-w-40`}>
            <option value="">All tags</option>
            {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="proj-sort" className="sr-only">Sort projects</label>
          <select id="proj-sort" data-testid="proj-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${fieldCls} w-auto`}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div role="group" aria-label="Layout" className="flex rounded-full border border-line bg-surface p-0.5">
          {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" data-testid={`view-${v}`} aria-pressed={view === v} aria-label={label} onClick={() => setView(v)} className={`grid size-11 place-items-center rounded-full ${view === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Filter by status" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} type="button" data-testid={`chip-${s}`} aria-pressed={status === s} onClick={() => setStatus(s)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${status === s ? "border-accent bg-accent font-semibold text-accent-fg" : "border-line bg-surface text-muted hover:border-accent hover:text-fg"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
            {s === "all" ? "All" : STATUS_LABEL[s]}
            <span data-testid={`count-${s}`} className={`rounded-full px-1.5 text-xs ${status === s ? "bg-accent-fg/15" : "bg-surface-2"}`}>{counts[s]}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted" role="status" aria-live="polite" data-testid="proj-count">
        {list.length} project{list.length === 1 ? "" : "s"}{filtered ? " match your filters" : ""}
      </p>

      {list.length === 0 ? (
        <div data-testid="proj-empty" className="rounded-2xl border border-dashed border-line p-10 text-center">
          <Layers className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-2 font-medium">{filtered ? "No projects match these filters" : "No projects yet"}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {filtered && <Button variant="secondary" onClick={() => { setQ(""); setStatus("all"); setOwner(""); setTag(""); }}>Clear filters</Button>}
            {!filtered && <Button variant="secondary" onClick={resetDemo}>Restore sample projects</Button>}
          </div>
        </div>
      ) : view === "grid" ? (
        <ul data-testid="proj-grid" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
          {list.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}
        </ul>
      ) : (
        <ul data-testid="proj-list" className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/90">
          {list.map((p) => <ProjectRow key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}
        </ul>
      )}

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id); }} />
      {open && <ProjectDrawer key={open.id} project={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const first = currentAssets(p).map(getAsset).filter((a) => !!a);
  return (
    <li data-testid="project-card" data-status={p.status} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface/90 transition-colors hover:border-accent">
      <div className="relative aspect-video bg-surface-2">
        {first[0] ? <AssetTile asset={first[0]} className="absolute inset-0 rounded-none" sizes="(min-width:1024px) 25vw, 90vw" /> : <div className="grid h-full place-items-center text-xs text-muted">No assets yet</div>}
        <span className="absolute left-2 top-2"><ProjectStatus status={p.status} /></span>
        {first.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-scrim px-2 py-0.5 text-xs text-white">{first.length} assets</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="min-w-0 break-words text-base font-semibold leading-snug">
          <button type="button" data-testid="open-project" onClick={onOpen} className="text-left hover:text-accent-text focus-visible:outline-none focus-visible:underline">{p.name}</button>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{p.description || "No description."}</p>
        <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">#{t}</span>)}</div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted">
          <span>{p.owner}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" aria-hidden />{p.comments.length}</span>
          <span>v{p.versions.length}</span>
          <LocalTime iso={p.updatedAt} className="ml-auto" />
        </div>
      </div>
    </li>
  );
}

function ProjectRow({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const first = currentAssets(p).map(getAsset).find((a) => !!a);
  return (
    <li data-testid="project-row" data-status={p.status} className="flex flex-wrap items-center gap-3 p-3 hover:bg-surface-2/60">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">{first && <AssetTile asset={first} className="absolute inset-0 rounded-none" sizes="56px" />}</div>
      <div className="min-w-0 flex-1 basis-48">
        <button type="button" data-testid="open-project" onClick={onOpen} className="block max-w-full break-words text-left font-semibold hover:text-accent-text focus-visible:outline-none focus-visible:underline">{p.name}</button>
        <p className="truncate text-xs text-muted">{p.owner} · {currentAssets(p).length} assets · v{p.versions.length} · {p.comments.length} comments</p>
      </div>
      <ProjectStatus status={p.status} />
      <LocalTime iso={p.updatedAt} className="w-36 text-xs text-muted" />
    </li>
  );
}

function ProjectsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading projects" className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-2" />)}
      </div>
    </div>
  );
}
