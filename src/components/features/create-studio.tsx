"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dices, Download, Sparkles, Upload, X, Zap } from "lucide-react";
import { fetchFeedPage } from "@/lib/feed-cache";
import { ASPECT_SIZE, ASPECTS, MODELS, SURPRISE_PROMPTS, getModel, type Aspect, type Kind } from "@/lib/models";
import type { Generation } from "@/lib/generate";
import { useStore } from "@/lib/store";

const DEFAULT_PROMPT = "A neon-lit koi pond floating above a rainy Tokyo skyline, cinematic";
const TIPS = [
  "Describe lighting and lens (golden hour, 35mm) for more cinematic results.",
  "Short, concrete prompts beat long vague ones.",
  "Remix a community prompt and change just one noun.",
  "Claim your daily streak on Home for free credits.",
  "Video costs more credits. Draft the idea as an image first.",
];

export function CreateStudio() {
  const sp = useSearchParams();
  const qModel = getModel(sp.get("model"));
  const remixId = sp.get("remix");
  const [kind, setKind] = useState<Kind>(qModel?.kind ?? "image");
  const [model, setModel] = useState(qModel?.id ?? "soul-v2");
  const [prompt, setPrompt] = useState(sp.get("prompt")?.slice(0, 500) ?? (remixId ? "" : DEFAULT_PROMPT));
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [tip, setTip] = useState(0);
  const [ref, setRef] = useState<string | null>(null);
  const promptEl = useRef<HTMLTextAreaElement>(null);
  const credits = useStore((s) => s.credits);
  const spend = useStore((s) => s.spend);
  const addToLibrary = useStore((s) => s.addToLibrary);

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

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 2200);
    return () => clearInterval(t);
  }, [busy]);

  const pickKind = (k: Kind) => {
    setKind(k);
    if (getModel(model)?.kind !== k) setModel(MODELS.find((m) => m.kind === k)!.id);
  };

  const surprise = () => {
    const m = MODELS[Math.floor(Math.random() * MODELS.length)];
    setKind(m.kind);
    setModel(m.id);
    setPrompt(SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)]);
    setError(null);
  };

  const run = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setError(null);
    setUpsell(false);
    if (!spend(cost)) {
      setUpsell(true);
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, model: cur.id, prompt: p, aspect }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      const gen = data as Generation;
      setResult(gen);
      addToLibrary({ id: gen.id, url: gen.url, kind: gen.kind, prompt: gen.prompt, model: gen.model, aspect: gen.aspect, createdAt: gen.createdAt });
    } catch (e) {
      useStore.setState((s) => ({ credits: s.credits + cost }));
      setError(e instanceof Error ? e.message : "Something went wrong. Credits refunded.");
    } finally {
      setBusy(false);
    }
  };

  const { w, h } = ASPECT_SIZE[result?.aspect ?? aspect];

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
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
            <Dices size={16} className="text-accent" /> Surprise me
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
                className={`min-h-11 min-w-14 rounded-xl border px-3 text-sm ${aspect === a ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
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
        <p className="text-center text-xs text-muted" suppressHydrationWarning>
          You have {credits} credits
        </p>

        {upsell && (
          <div data-testid="credits-upsell" className="rounded-2xl border border-accent bg-accent/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Zap size={16} className="text-accent" /> Not enough credits
            </p>
            <p className="mt-1 text-sm text-muted">This needs {cost} credits and you have {credits}. Claim your daily bonus or upgrade.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">See plans</Link>
              <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-fg">Claim daily credits</Link>
            </div>
          </div>
        )}
        {error && (
          <div data-testid="gen-error" role="alert" className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-fg">
            {error}
          </div>
        )}
      </div>

      <div className="min-h-80">
        {busy ? (
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative animate-pulse bg-surface-2" style={{ aspectRatio: `${w} / ${h}` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent motion-safe:animate-pulse" />
            </div>
            <div className="p-4" role="status" aria-live="polite">
              <p className="text-sm font-medium text-fg">Creating your {kind}...</p>
              <p className="mt-1 text-sm text-muted">Tip: {TIPS[tip]}</p>
            </div>
          </div>
        ) : result ? (
          <div data-testid="result-card" className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface">
            <div style={{ aspectRatio: `${w} / ${h}` }} className="bg-surface-2">
              <Image src={result.url} alt={result.prompt} width={w} height={h} unoptimized className="h-full w-full object-cover" />
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-fg">{result.prompt}</p>
              <p className="text-xs text-muted">{getModel(result.model)?.name} · {result.aspect} · saved to your library</p>
              <div className="flex flex-wrap gap-2">
                <a href={result.url} download={`${result.id}.svg`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg">
                  <Download size={16} /> Download
                </a>
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
