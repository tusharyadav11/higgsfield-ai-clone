"use client";
import { useState } from "react";
import { Archive, ArchiveRestore, Check, GitCompare, MessageSquare, Pencil, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { Modal } from "../shared/Modal";
import { LocalTime } from "../shared/LocalTime";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import {
  ACTOR, COMMENT_MAX, REASON_MAX, canApprove, canComment, canEdit, compareVersions, currentAssets, getAsset, latestVersion, splitMentions, useProjects,
  type Decision, type Out, type Project,
} from "@/lib/enterprise/projects-store";
import { ROLE_LABEL } from "@/lib/enterprise/roles";
import { errCls, fieldCls, hintCls, labelCls, textareaCls } from "../shared/ui";
import { AssetKindIcon, AssetPicker, AssetTile, ProjectStatus, useActing } from "./parts";

const TABS = [
  { id: "assets", label: "Assets" },
  { id: "versions", label: "Versions" },
  { id: "comments", label: "Comments" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function ProjectDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("assets");
  const { role, ctx } = useActing();
  const st = useProjects();
  const [reasonFor, setReasonFor] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const edit = canEdit(role);
  const approve = canApprove(role);
  const assets = currentAssets(project);
  const result = (r: Out, ok: string) => {
    if (r.ok) {
      setErr("");
      showToast(ok);
    } else setErr(r.error);
    return r.ok;
  };

  const doDecide = (d: Decision) => {
    if (d !== "approved" && reasonFor !== d) {
      setReasonFor(d);
      setReason("");
      setErr("");
      return;
    }
    if (result(st.decide(project.id, d, d === "approved" ? "" : reason, ctx()), d === "approved" ? "Project approved (demo workspace)." : d === "changes_requested" ? "Changes requested." : "Project rejected and archived.")) {
      setReasonFor(null);
      setReason("");
    }
  };

  const rv = project.review;
  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={project.name}
      testId="project-drawer"
      headerExtra={
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <ProjectStatus status={project.status} />
          <span>Owner: {project.owner}</span>
          {project.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">#{t}</span>
          ))}
        </div>
      }
    >
      {project.description && <p className="text-sm text-muted">{project.description}</p>}

      {/* approval workflow */}
      <section aria-label="Approval workflow" data-testid="approval-box" className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
        <h3 className="text-sm font-semibold">Approval workflow</h3>
        {rv && project.status !== "in_review" && (
          <p data-testid="review-note" className="mt-1 text-sm text-muted">
            {rv.decision === "approved" ? "Approved" : rv.decision === "changes_requested" ? "Changes requested" : "Rejected"} by {rv.by}
            {rv.reason ? `: “${rv.reason}”` : "."}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Acting as <strong className="text-fg">{ROLE_LABEL[role]}</strong>. Editors can submit; only Admins and Owners can approve, request changes or reject.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {project.status === "draft" && (
            <Button data-testid="submit-review" disabled={!edit || !assets.length} onClick={() => result(st.submit(project.id, ctx()), "Submitted for review.")}>
              <Send className="size-4" aria-hidden /> Submit for review
            </Button>
          )}
          {project.status === "in_review" && approve && (
            <>
              <Button data-testid="approve-btn" onClick={() => doDecide("approved")}>
                <Check className="size-4" aria-hidden /> Approve
              </Button>
              <Button variant="secondary" data-testid="request-changes-btn" aria-pressed={reasonFor === "changes_requested"} onClick={() => doDecide("changes_requested")}>
                Request changes
              </Button>
              <Button variant="secondary" data-testid="reject-btn" aria-pressed={reasonFor === "rejected"} onClick={() => doDecide("rejected")}>
                <X className="size-4" aria-hidden /> Reject
              </Button>
            </>
          )}
          {project.status === "archived" && (
            <Button data-testid="unarchive-btn" disabled={!edit} onClick={() => result(st.unarchive(project.id, ctx()), "Project restored.")}>
              <ArchiveRestore className="size-4" aria-hidden /> Restore project
            </Button>
          )}
          {project.status !== "archived" && (
            <Button variant="secondary" data-testid="archive-btn" disabled={!edit} onClick={() => result(st.archive(project.id, ctx()), "Project archived. You can restore it any time.")}>
              <Archive className="size-4" aria-hidden /> Archive
            </Button>
          )}
        </div>
        {project.status === "draft" && !edit && <p className="mt-2 text-xs text-muted">Submitting is disabled: Viewers cannot edit projects.</p>}
        {project.status === "draft" && edit && !assets.length && <p className="mt-2 text-xs text-muted">Submitting is disabled until the project has at least one asset.</p>}
        {project.status === "in_review" && !approve && <p data-testid="cannot-approve" className="mt-2 text-sm text-muted">Waiting for review. Your current role ({ROLE_LABEL[role]}) cannot approve. Switch “Acting as” to Admin or Owner to try the reviewer view.</p>}
        {reasonFor && (
          <div className="mt-3">
            <label htmlFor="decision-reason" className={labelCls}>
              Reason ({reasonFor === "rejected" ? "required, the project will be archived" : "required, the project returns to Draft"})
            </label>
            <textarea id="decision-reason" data-testid="decision-reason" data-autofocus rows={2} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaCls} />
            <div className="mt-2 flex gap-2">
              <Button data-testid="decision-confirm" onClick={() => doDecide(reasonFor)}>
                {reasonFor === "rejected" ? "Reject project" : "Send change request"}
              </Button>
              <Button variant="secondary" onClick={() => setReasonFor(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {err && (
          <p role="alert" data-testid="drawer-error" className={errCls}>
            {err}
          </p>
        )}
      </section>

      <div role="tablist" aria-label="Project sections" className="scrollbar-none mt-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`pd-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`pd-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            data-testid={`pd-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
                setTab(n);
                requestAnimationFrame(() => document.getElementById(`pd-tab-${n}`)?.focus());
              }
            }}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium ${tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
          >
            {t.label}
            {t.id === "comments" && project.comments.length > 0 && <span className="ml-1.5 text-xs text-muted">{project.comments.length}</span>}
            {t.id === "versions" && <span className="ml-1.5 text-xs text-muted">{project.versions.length}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`pd-panel-${tab}`} aria-labelledby={`pd-tab-${tab}`} className="pt-4">
        {tab === "assets" && <AssetsPanel project={project} />}
        {tab === "versions" && <VersionsPanel project={project} />}
        {tab === "comments" && <CommentsPanel project={project} />}
        {tab === "activity" && (
          <ol data-testid="activity-list" className="space-y-3">
            {project.activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="break-words"><strong>{a.actor}</strong> {a.text}</p>
                  <LocalTime iso={a.at} className="text-xs text-muted" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- assets ---------------- */

function AssetsPanel({ project }: { project: Project }) {
  const { role, ctx } = useActing();
  const st = useProjects();
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const edit = canEdit(role) && project.status !== "archived";
  const assets = currentAssets(project).map(getAsset).filter((a) => !!a);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted">
          {assets.length} shared asset{assets.length === 1 ? "" : "s"} from the local sample library. Every change saves a new version.
        </p>
        <Button variant="secondary" data-testid="add-assets-btn" disabled={!edit} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus className="size-4" aria-hidden /> Add assets
        </Button>
      </div>
      {!edit && <p className="mb-3 text-xs text-muted">{project.status === "archived" ? "Restore the project to edit assets." : "Your role is read-only for assets."}</p>}
      {adding && edit && (
        <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3">
          <AssetPicker selected={sel} exclude={currentAssets(project)} onToggle={(id) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
          {err && <p role="alert" className={errCls}>{err}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              data-testid="add-assets-confirm"
              onClick={() => {
                const r = st.addAssets(project.id, sel, ctx());
                if (r.ok) {
                  showToast(`Added ${sel.length} asset${sel.length === 1 ? "" : "s"} (new version saved).`);
                  setSel([]);
                  setAdding(false);
                  setErr("");
                } else setErr(r.error);
              }}
            >
              Add {sel.length || ""} to project
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {assets.length === 0 ? (
        <p data-testid="assets-empty" className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No assets yet. Add some from the sample library.</p>
      ) : (
        <ul data-testid="asset-gallery" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((a) => (
            <li key={a!.id} data-testid="gallery-asset" className="min-w-0">
              <AssetTile asset={a!} className="aspect-square" />
              <div className="mt-1 flex items-center gap-1 text-xs">
                <AssetKindIcon kind={a!.kind} />
                <span className="min-w-0 flex-1 truncate text-fg">{a!.title}</span>
                {edit && (
                  <button type="button" aria-label={`Remove ${a!.title}`} data-testid="remove-asset" onClick={() => { const r = st.removeAsset(project.id, a!.id, ctx()); showToast(r.ok ? `Removed ${a!.title} (new version saved).` : r.error); }} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- versions ---------------- */

function VersionsPanel({ project }: { project: Project }) {
  const { role, ctx } = useActing();
  const st = useProjects();
  const latest = latestVersion(project).n;
  const [a, setA] = useState(Math.max(1, latest - 1));
  const [b, setB] = useState(latest);
  const [cmp, setCmp] = useState(false);
  const edit = canEdit(role) && project.status !== "archived";
  const diff = cmp ? compareVersions(project, a, b) : null;
  const vs = [...project.versions].reverse();

  return (
    <div>
      <p className="mb-3 text-sm text-muted">History is append-only: restoring an old version creates a new one and never changes the past.</p>
      <ol data-testid="version-list" className="space-y-2">
        {vs.map((v) => (
          <li key={v.n} data-testid="version-row" className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold">v{v.n}</span>
            {v.n === latest && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">Current</span>}
            <span className="min-w-0 flex-1 basis-40 break-words">
              {v.note}
              <span className="block text-xs text-muted">
                {v.by} · <LocalTime iso={v.at} /> · {v.assets.length} asset{v.assets.length === 1 ? "" : "s"}
              </span>
            </span>
            {v.n !== latest && (
              <Button variant="secondary" data-testid="restore-version" disabled={!edit} aria-label={`Restore version ${v.n}`} onClick={() => { const r = st.restoreVersion(project.id, v.n, ctx()); showToast(r.ok ? `Restored v${v.n} as new version v${latest + 1}.` : r.error); }}>
                <RotateCcw className="size-4" aria-hidden /> Restore
              </Button>
            )}
          </li>
        ))}
      </ol>
      {!edit && <p className="mt-2 text-xs text-muted">Restore is disabled: {project.status === "archived" ? "the project is archived." : "your role cannot edit projects."}</p>}

      {project.versions.length > 1 && (
        <div className="mt-5 rounded-xl border border-line bg-surface-2 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><GitCompare className="size-4" aria-hidden /> Compare versions</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cmp-a" className={labelCls}>From</label>
              <select id="cmp-a" data-testid="cmp-a" value={a} onChange={(e) => setA(Number(e.target.value))} className={fieldCls}>
                {project.versions.map((v) => <option key={v.n} value={v.n}>v{v.n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cmp-b" className={labelCls}>To</label>
              <select id="cmp-b" data-testid="cmp-b" value={b} onChange={(e) => setB(Number(e.target.value))} className={fieldCls}>
                {project.versions.map((v) => <option key={v.n} value={v.n}>v{v.n}</option>)}
              </select>
            </div>
          </div>
          <Button className="mt-3" variant="secondary" data-testid="compare-btn" aria-expanded={cmp} onClick={() => setCmp((v) => !v)}>
            {cmp ? "Hide comparison" : "Compare"}
          </Button>
          {cmp && diff && (
            <div data-testid="compare-view" className="mt-3 grid gap-3 sm:grid-cols-2">
              {[{ n: a, mark: "removed" as const }, { n: b, mark: "added" as const }].map(({ n, mark }, col) => {
                const v = project.versions.find((x) => x.n === n)!;
                return (
                  <div key={col} data-testid={`compare-col-${col}`}>
                    <p className="mb-1 text-xs font-semibold">v{n} <span className="font-normal text-muted">({v.assets.length} assets)</span></p>
                    <ul className="grid grid-cols-3 gap-1.5">
                      {v.assets.map((id) => {
                        const as = getAsset(id);
                        if (!as) return null;
                        const flag = mark === "removed" ? (diff.removed.includes(id) ? "Removed" : null) : diff.added.includes(id) ? "Added" : null;
                        return (
                          <li key={id} className="relative">
                            <AssetTile asset={as} className="aspect-square" sizes="96px" />
                            {flag && <span data-testid="diff-flag" className={`absolute inset-x-0 bottom-0 text-center text-[10px] font-semibold ${flag === "Added" ? "bg-success text-white" : "bg-danger text-white"}`}>{flag}</span>}
                          </li>
                        );
                      })}
                      {v.assets.length === 0 && <li className="col-span-3 text-xs text-muted">No assets.</li>}
                    </ul>
                  </div>
                );
              })}
              <p className="text-xs text-muted sm:col-span-2" data-testid="compare-summary">
                {diff.added.length} added, {diff.removed.length} removed, {diff.kept.length} unchanged between v{a} and v{b}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- comments ---------------- */

function Mentions({ text }: { text: string }) {
  return (
    <>
      {splitMentions(text).map((s, i) =>
        s.mention ? <mark key={i} data-testid="mention" className="rounded bg-accent/20 px-0.5 font-medium text-accent-text">{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function CommentsPanel({ project }: { project: Project }) {
  const { role, ctx } = useActing();
  const st = useProjects();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [del, setDel] = useState<string | null>(null);
  const can = canComment(role);

  return (
    <div>
      <ul data-testid="comment-list" className="space-y-3">
        {project.comments.length === 0 && <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No comments yet. Start the conversation.</li>}
        {project.comments.map((c) => {
          const mine = c.author === ACTOR;
          return (
            <li key={c.id} data-testid="comment" className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold ${mine ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"}`} aria-hidden>{c.author[0]}</span>
                <strong className="text-fg">{c.author}</strong>
                <LocalTime iso={c.at} />
                {c.editedAt && <span>(edited)</span>}
              </div>
              {editing === c.id ? (
                <div className="mt-2">
                  <label htmlFor={`edit-${c.id}`} className="sr-only">Edit comment</label>
                  <textarea id={`edit-${c.id}`} data-testid="comment-edit-input" data-autofocus rows={2} maxLength={COMMENT_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} className={textareaCls} />
                  <div className="mt-2 flex gap-2">
                    <Button data-testid="comment-save" onClick={() => { const r = st.editComment(project.id, c.id, draft, ctx()); if (r.ok) { setEditing(null); setErr(""); } else setErr(r.error); }}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm"><Mentions text={c.text} /></p>
              )}
              {mine && editing !== c.id && (
                <div className="mt-2 flex gap-1">
                  <button type="button" data-testid="comment-edit" onClick={() => { setEditing(c.id); setDraft(c.text); setErr(""); }} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs text-muted hover:bg-surface-2 hover:text-fg">
                    <Pencil className="size-3.5" aria-hidden /> Edit
                  </button>
                  <button type="button" data-testid="comment-delete" onClick={() => setDel(c.id)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs text-muted hover:bg-surface-2 hover:text-danger">
                    <Trash2 className="size-3.5" aria-hidden /> Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const r = st.comment(project.id, text, ctx());
          if (r.ok) { setText(""); setErr(""); } else setErr(r.error);
        }}
      >
        <label htmlFor="new-comment" className={labelCls}>Add a comment</label>
        <textarea id="new-comment" data-testid="comment-input" rows={3} maxLength={COMMENT_MAX} disabled={!can} value={text} onChange={(e) => setText(e.target.value)} className={textareaCls} placeholder="Write a comment. Use @name to mention a teammate." />
        <p className={hintCls}>{text.trim().length}/{COMMENT_MAX}. @mentions are highlighted; in this demo nobody is notified.</p>
        {err && <p role="alert" className={errCls}>{err}</p>}
        <Button type="submit" className="mt-2" data-testid="comment-post" disabled={!can}>
          <MessageSquare className="size-4" aria-hidden /> Post comment
        </Button>
      </form>

      <ConfirmDialog
        open={!!del}
        title="Delete this comment?"
        confirmLabel="Delete comment"
        cancelLabel="Keep it"
        onCancel={() => setDel(null)}
        onConfirm={() => { if (del) st.deleteComment(project.id, del, ctx()); setDel(null); showToast("Comment deleted."); }}
      >
        <p>This removes your comment from the project in this browser. It cannot be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

