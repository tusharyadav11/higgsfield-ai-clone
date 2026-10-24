"use client";
import { useState } from "react";
import { Modal } from "../shared/Modal";
import { Button } from "@/components/ui/Button";
import { SAMPLE_MEMBERS } from "@/lib/enterprise/demo-data";
import { DESC_MAX, NAME_MAX, validateCreate, useProjects, type CreateErrors } from "@/lib/enterprise/projects-store";
import { errCls, fieldCls, hintCls, labelCls, textareaCls } from "../shared/ui";
import { AssetPicker, useActing } from "./parts";

const OWNERS = SAMPLE_MEMBERS.filter((m) => m.status === "active").map((m) => m.name);

export function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const projects = useProjects((s) => s.projects);
  const create = useProjects((s) => s.create);
  const { ctx } = useActing();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(OWNERS[0]);
  const [tags, setTags] = useState("");
  const [assets, setAssets] = useState<string[]>([]);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [formErr, setFormErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCreate(projects, { name, description, owner, tags });
    setErrors(errs);
    setFormErr("");
    if (Object.keys(errs).length) return;
    const r = create({ name, description, owner, tags, assets }, ctx());
    if (!r.ok) return setFormErr(r.error);
    setName("");
    setDescription("");
    setTags("");
    setAssets([]);
    onCreated(r.id!);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create project"
      description="Stored in this browser only (demo workspace)."
      testId="create-project-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-project-form" data-testid="create-project-submit">
            Create project
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="cp-name" className={labelCls}>
            Name
          </label>
          <input id="cp-name" data-autofocus data-testid="cp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX + 20} aria-invalid={!!errors.name} aria-describedby={errors.name ? "cp-name-e" : undefined} className={fieldCls} placeholder="e.g. Autumn lookbook" />
          {errors.name && (
            <p id="cp-name-e" role="alert" className={errCls}>
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="cp-desc" className={labelCls}>
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="cp-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaCls} aria-invalid={!!errors.description} />
          <p className={hintCls}>
            {description.trim().length}/{DESC_MAX}
          </p>
          {errors.description && (
            <p role="alert" className={errCls}>
              {errors.description}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cp-owner" className={labelCls}>
              Owner
            </label>
            <select id="cp-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={fieldCls}>
              {OWNERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            {errors.owner && (
              <p role="alert" className={errCls}>
                {errors.owner}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="cp-tags" className={labelCls}>
              Tags <span className="font-normal text-muted">(comma separated)</span>
            </label>
            <input id="cp-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={fieldCls} placeholder="campaign, social" aria-invalid={!!errors.tags} />
            {errors.tags && (
              <p role="alert" className={errCls}>
                {errors.tags}
              </p>
            )}
          </div>
        </div>
        <fieldset>
          <legend className={labelCls}>
            Starting assets <span className="font-normal text-muted">(optional, from the local sample library)</span>
          </legend>
          <AssetPicker selected={assets} onToggle={(id) => setAssets((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
        </fieldset>
        {formErr && (
          <p role="alert" className={errCls}>
            {formErr}
          </p>
        )}
      </form>
    </Modal>
  );
}
