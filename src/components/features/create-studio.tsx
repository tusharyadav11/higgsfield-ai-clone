"use client";

import Image from "next/image";
import { MediaView } from "./media-view";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Copy, Dices, Download, Link2, RefreshCw, Sparkles, Upload, Wand2, X, Zap } from "lucide-react";
import { fetchFeedPage } from "@/lib/feed-cache";
import { ASPECT_SIZE, ASPECTS, MODELS, SURPRISE_PROMPTS, getModel, type Aspect, type Kind } from "@/lib/models";
import { useStore } from "@/lib/store";
import { useJobs } from "@/lib/jobs";
import { JobProgress, SyncBadge } from "@/components/jobs";

const DEFAULT_PROMPT = "A neon-lit koi pond floating above a rainy Tokyo skyline, cinematic";
const STYLE_BITS = ["cinematic lighting", "shot on 35mm, shallow depth of field", "ultra detailed", "volumetric light", "rich color grading"];

/** Deterministic local prompt enhancer: appends style/lighting/camera terms that are not already present. */
export function enhancePrompt(p: string, kind: Kind): string {
  const base = p.trim().replace(/[.,\s]+$/, "");
  const lower = base.toLowerCase();
  const extra = (kind === "video" ? ["slow dolly-in camera move", ...STYLE_BITS] : STYLE_BITS).filter(
    (t) => !t.split(/,\s*/).some((w) => lower.includes(w.toLowerCase())),
  );
  const out = [base, ...extra].join(", ");
  if (out.length <= 500) return out;
  let acc = base;
  for (const t of extra) if ((acc + ", " + t).length <= 500) acc += ", " + t;
  return acc.slice(0, 500);
}

export function CreateStudio() {
  const sp = useSearchParams();
  const qModel = getModel(sp.get("model"));
  const remixId = sp.get("remix");
  const [kind, setKind] = useState<Kind>(qModel?.kind ?? "image");
  const [model, setModel] = useState(qModel?.id ?? "soul-v2");
  const [prompt, setPrompt] = useState(sp.get("prompt")?.slice(0, 500) ?? (remixId ? "" : DEFAULT_PROMPT));
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [upsell, setUpsell] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"prompt" | "link" | null>(null);
  const jobParam = sp.get("job");
  const [activeId, setActiveId] = useState<string | null>(
    () => jobParam ?? useJobs.getState().jobs.find((j) => j.status === "running")?.id ?? null,
  );
  const [ref, setRef] = useState<string | null>(null);
  const promptEl = useRef<HTMLTextAreaElement>(null);
  const credits = useStore((s) => s.credits);
  const startJob = useJobs((s) => s.start);
  const retryJob = useJobs((s) => s.retry);
  const job = useJobs((s) => s.jobs.find((j) => j.id === activeId) ?? null);
  const busy = job?.status === "running";
  const result = job?.status === "done" ? (job.result ?? null) : null;
  const error = job?.status === "error" ? (job.error ?? "Generation failed") : null;

  const models = MODELS.filter((m) => m.kind === kind);
  const cur = getModel(model) ?? models[0];
  const cost = cur.credits;

  useEffect(() => {
    promptEl.current?.focus();
  }, []);

  // Remix by id only (no prompt in the URL): resolve from the feed.
  useEffect(() => {
    if (!remixId || sp.get("prompt")) return;
    let live = true;
    fetchFeedPage("", null, 48)
      .then((p) => {
        const post = p.items.find((i) => i.id === remixId);
        if (!live || !post) return;
        setPrompt(post.prompt);
        setKind(post.kind);
        setModel(post.model);
        setAspect(post.aspect);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [remixId, sp]);

  const pickKind = (k: Kind) => {
    setKind(k);
    if (getModel(model)?.kind !== k) setModel(MODELS.find((m) => m.kind === k)!.id);
  };

  const surprise = () => {
    const m = MODELS[Math.floor(Math.random() * MODELS.length)];
    setKind(m.kind);
    setModel(m.id);
    setPrompt(SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)]);
    setNotice(null);
  };

  const run = () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setNotice(null);
    setUpsell(false);
    const r = startJob({ kind, model: cur.id, prompt: p, aspect });
    if (r === "insufficient") setUpsell(true);
    else if (r !== "invalid") setActiveId(r.id);
  };

  const retry = () => {
    if (!job) return;
    setUpsell(false);
    const r = retryJob(job.id);
    if (r === "insufficient") setUpsell(true);
    else if (r !== "invalid") setActiveId(r.id);
  };

  const flash = (k: "prompt" | "link") => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1800);
  };
  const copy = async (text: string, k: "prompt" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      flash(k);
    } catch {
      setNotice("Copy was blocked by the browser.");
    }
  };
  const shareLink = (g: { prompt: string; model: string }) =>
    `${window.location.origin}/create?${new URLSearchParams({ prompt: g.prompt, model: g.model }).toString()}`;

  const toVideo = () => {
    if (!result) return;
    const vm = MODELS.find((m) => m.kind === "video")!;
    setKind("video");
    setModel(vm.id);
    setPrompt(result.prompt);
    setRef(result.url);
    setNotice("Ready to animate: pick a video model if you like, then hit Generate.");
    promptEl.current?.focus();
  };

  const { w, h } = ASPECT_SIZE[result?.aspect ?? job?.aspect ?? aspect];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
      <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(["image", "video"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`kind-${k}`}
              aria-pressed={kind === k}
              onClick={() => pickKind(k)}
              className={`min-h-11 rounded-full px-5 text-sm font-medium capitalize ${kind === k ? "bg-accent text-accent-fg" : "text-muted"}`}
            >
              {k}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="prompt" className="text-sm font-medium text-fg">Prompt</label>
            <span className="text-xs text-muted">{prompt.length}/500</span>
          </div>
          <textarea
            id="prompt"
            ref={promptEl}
            data-testid="prompt-input"
            value={prompt}
            maxLength={500}
            rows={5}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              // Enter (or Cmd/Ctrl+Enter) generates, Shift+Enter adds a newline
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (!busy && prompt.trim()) run();
            }}
            placeholder="Describe what you want to see..."
            className="w-full resize-none rounded-2xl border border-line bg-surface p-3 text-sm text-fg outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            data-testid="surprise-btn"
            onClick={surprise}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg hover:border-accent"
          >
            <Dices size={16} className="text-accent-text" /> Surprise me
          </button>
          <button
            type="button"
            data-testid="enhance-btn"
            disabled={!prompt.trim()}
            onClick={() => setPrompt(enhancePrompt(prompt, kind))}
            className="ml-2 mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg hover:border-accent disabled:opacity-50"
          >
            <Wand2 size={16} className="text-accent-text" /> Enhance
          </button>
        </div>

        <div>
          <label htmlFor="model" className="mb-2 block text-sm font-medium text-fg">Model</label>
          <select
            id="model"
            data-testid="model-select"
            value={cur.id}
            onChange={(e) => setModel(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-accent"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.credits} credits · {m.speed}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Aspect</p>
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`aspect-${a}`}
                aria-pressed={aspect === a}
                onClick={() => setAspect(a)}
                className={`min-h-11 min-w-14 rounded-xl border px-3 text-sm ${aspect === a ? "border-accent bg-accent/15 text-accent-text" : "border-line text-muted"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Reference (optional)</p>
          {ref ? (
            <div className="relative inline-block">
              <Image src={ref} alt="Reference" width={96} height={96} unoptimized className="size-24 rounded-xl object-cover" />
              <button type="button" aria-label="Remove reference" onClick={() => setRef(null)} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-surface-2 text-fg">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:border-accent">
              <Upload size={16} /> Upload an image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setRef(URL.createObjectURL(f));
                }}
              />
            </label>
          )}
        </div>

        <button
          type="button"
          data-testid="generate-btn"
          disabled={busy || !prompt.trim()}
          onClick={run}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={16} />
          {busy ? "Generating..." : `Generate · ${cost} credits`}
        </button>
        <p className="flex items-center justify-center gap-3 text-center text-xs text-muted" suppressHydrationWarning>
          <span suppressHydrationWarning>You have {credits} credits</span>
          <SyncBadge />
        </p>
        {notice && <p className="text-center text-xs text-muted">{notice}</p>}

        {upsell && (
          <div data-testid="credits-upsell" className="rounded-2xl border border-accent bg-accent/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Zap size={16} className="text-accent-text" /> Not enough credits
            </p>
            <p className="mt-1 text-sm text-muted">This needs {cost} credits and you have {credits}. Claim your daily bonus or upgrade.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">See plans</Link>
              <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-fg">Claim daily credits</Link>
            </div>
          </div>
        )}
        {error && (
          <div data-testid="gen-error" role="alert" className="rounded-2xl border border-danger-line bg-danger-bg p-4 text-sm text-fg">
            <p>{error}</p>
            <button type="button" data-testid="retry-btn" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg hover:border-accent">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}
      </div>

      <div className="min-h-80">
        {busy && job ? (
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative animate-pulse bg-surface-2 motion-reduce:animate-none" style={{ aspectRatio: `${w} / ${h}` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm font-medium text-fg">Creating your {job.kind}...</p>
              <JobProgress job={job} />
            </div>
          </div>
        ) : result ? (
          <div data-testid="result-card" className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface">
            <MediaView kind={result.kind} src={result.url} poster={result.poster} aspect={result.aspect} alt={result.prompt} priority />
            <div className="space-y-3 p-4">
              <p className="text-sm text-fg">{result.prompt}</p>
              <p className="text-xs text-muted">{getModel(result.model)?.name} · {result.aspect} · saved to your library</p>
              <div className="flex flex-wrap gap-2">
                <a href={result.url} download={`${result.id}.${result.url.split(".").pop()?.split("?")[0] || "jpg"}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg">
                  <Download size={16} /> Download
                </a>
                <button type="button" data-testid="copy-prompt-btn" onClick={() => copy(result.prompt, "prompt")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg">
                  {copied === "prompt" ? <Check size={16} /> : <Copy size={16} />} {copied === "prompt" ? "Copied" : "Copy prompt"}
                </button>
                <button type="button" data-testid="share-btn" onClick={() => copy(shareLink(result), "link")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg">
                  {copied === "link" ? <Check size={16} /> : <Link2 size={16} />} {copied === "link" ? "Link copied" : "Share link"}
                </button>
                {result.kind === "image" && (
                  <button type="button" data-testid="to-video-btn" onClick={toVideo} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg hover:border-accent">
                    <Clapperboard size={16} /> Make a video from this image
                  </button>
                )}
                <Link href="/library" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-fg">View library</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-80 place-items-center rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Your creation appears here. Hit Generate to try it.
          </div>
        )}
      </div>
    </div>
  );
}
