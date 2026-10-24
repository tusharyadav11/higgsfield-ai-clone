#!/usr/bin/env node
/**
 * Records the Kinetic product-tour video against a live deployment (guest flows only).
 * Usage: node scripts/tour/record.mjs   (env: TOUR_URL, TOUR_OUT, TOUR_KEEP=1)
 * See scripts/tour/README.md. Needs: playwright (devDependency) + /opt/homebrew/bin/ffmpeg (or FFMPEG env).
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = (process.env.TOUR_URL || "https://higgsfield-ai-clone-one.vercel.app").replace(/\/$/, "");
const OUT = process.env.TOUR_OUT || path.join(ROOT, "public/media/tour");
const FFMPEG = process.env.FFMPEG || (fs.existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");
const WORK = fs.mkdtempSync(path.join(process.env.TOUR_TMP || os.tmpdir(), "kinetic-tour-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- on-page overlay: cursor, caption lower-third, chapter chip, end card ---------- */
const OVERLAY = () => {
  if (window.__tourInstalled) return;
  window.__tourInstalled = true;
  try {
    localStorage.setItem("kinetic.tour.seen", '"1"');
    localStorage.setItem("kinetic.engage.v1", JSON.stringify({ v: 1, paused: true }));
    sessionStorage.setItem("kinetic.engage.debug", "0");
  } catch {}
  const css = `
  #kt-root{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Geist,Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
  #kt-cover{position:absolute;inset:0;background:#0a0a0a;opacity:1;transition:opacity .6s ease}
  #kt-cursor{position:absolute;left:0;top:0;width:34px;height:34px;transform:translate(-100px,-100px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.55));transition:opacity .3s}
  #kt-cursor svg{display:block;transform-origin:4px 3px;transition:transform .12s}
  #kt-cursor.down svg{transform:scale(.86)}
  .kt-ripple{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #c6ff3d;background:rgba(198,255,61,.22);animation:kt-rip .7s ease-out forwards}
  @keyframes kt-rip{from{transform:scale(.3);opacity:1}to{transform:scale(3.2);opacity:0}}
  #kt-cap{position:absolute;left:50%;bottom:34px;transform:translate(-50%,16px);max-width:1040px;width:max-content;padding:16px 30px 16px 26px;border-radius:18px;background:rgba(10,10,10,.88);border:1px solid rgba(255,255,255,.14);border-left:6px solid #c6ff3d;box-shadow:0 14px 40px rgba(0,0,0,.45);color:#fff;opacity:0;transition:opacity .45s ease,transform .45s ease;backdrop-filter:blur(8px)}
  #kt-cap.on{opacity:1;transform:translate(-50%,0)}
  #kt-cap.top{bottom:auto;top:88px}
  #kt-cap b{display:block;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
  #kt-cap span{display:block;margin-top:5px;font-size:20px;line-height:1.3;color:rgba(255,255,255,.78)}
  #kt-chip{position:absolute;bottom:22px;left:18px;display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;background:rgba(10,10,10,.85);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:16px;font-weight:600;opacity:0;transition:opacity .4s}
  #kt-chip.on{opacity:1}
  #kt-chip i{font-style:normal;color:#0a0a0a;background:#c6ff3d;border-radius:999px;padding:1px 9px;font-weight:700}
  #kt-bar{position:absolute;left:0;top:0;height:5px;background:#c6ff3d;width:0;transition:width .8s linear}
  #kt-end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;background:radial-gradient(900px 500px at 50% 40%,#1d2a05 0%,#0a0a0a 70%);color:#fff;opacity:0;transition:opacity .8s ease}
  #kt-end.on{opacity:1}
  #kt-end h1{margin:0;font-size:84px;letter-spacing:-.04em;font-weight:800}
  #kt-end h1 em{font-style:normal;color:#c6ff3d}
  #kt-end p{margin:0;font-size:30px;color:rgba(255,255,255,.82)}
  #kt-end a{margin-top:10px;padding:16px 38px;border-radius:999px;background:#c6ff3d;color:#0a0a0a;font-size:28px;font-weight:700;text-decoration:none}
  #kt-end small{font-size:20px;color:rgba(255,255,255,.55)}`;
  const mount = () => {
    const st = document.createElement("style");
    st.textContent = css;
    const root = document.createElement("div");
    root.id = "kt-root";
    root.innerHTML = `<div id="kt-cursor"><svg width="34" height="34" viewBox="0 0 34 34"><path d="M4 3 L4 26 L10 20.5 L14.2 30 L18.4 28.2 L14.2 18.8 L22.5 18.8 Z" fill="#fff" stroke="#0a0a0a" stroke-width="2" stroke-linejoin="round"/></svg></div>
    <div id="kt-chip"><i></i><span></span></div><div id="kt-cap"><b></b><span></span></div><div id="kt-bar"></div><div id="kt-end"><h1>Kinetic<em>.</em></h1><p>See it. Remix it. Make it yours.</p><a>Start creating free</a><small></small></div><div id="kt-cover"></div>`;
    document.documentElement.append(st, root);
    const cur = root.querySelector("#kt-cursor");
    const place = (x, y) => (cur.style.transform = `translate(${x - 4}px,${y - 3}px)`);
    let last = null;
    try { last = JSON.parse(sessionStorage.getItem("kt.pos") || "null"); } catch {}
    if (last) place(last.x, last.y);
    addEventListener("mousemove", (e) => {
      place(e.clientX, e.clientY);
      try { sessionStorage.setItem("kt.pos", JSON.stringify({ x: e.clientX, y: e.clientY })); } catch {}
    }, true);
    addEventListener("mousedown", (e) => {
      cur.classList.add("down");
      const r = document.createElement("div");
      r.className = "kt-ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      root.append(r);
      setTimeout(() => r.remove(), 800);
    }, true);
    addEventListener("mouseup", () => cur.classList.remove("down"), true);
    const $ = (s) => root.querySelector(s);
    window.__kt = {
      reveal: () => ($("#kt-cover").style.opacity = "0"),
      cover: () => ($("#kt-cover").style.opacity = "1"),
      caption(title, sub, top) {
        const c = $("#kt-cap");
        c.classList.toggle("top", !!top);
        c.querySelector("b").textContent = title;
        c.querySelector("span").textContent = sub || "";
        c.querySelector("span").style.display = sub ? "block" : "none";
        c.classList.add("on");
        try { sessionStorage.setItem("kt.cap", JSON.stringify([title, sub || ""])); } catch {}
      },
      hideCaption() {
        $("#kt-cap").classList.remove("on");
        try { sessionStorage.removeItem("kt.cap"); } catch {}
      },
      chip(n, total, label) {
        $("#kt-chip i").textContent = `${n}/${total}`;
        $("#kt-chip span").textContent = label;
        $("#kt-chip").classList.add("on");
        $("#kt-bar").style.width = `${(n / total) * 100}%`;
        try { sessionStorage.setItem("kt.chip", JSON.stringify([n, total, label])); } catch {}
      },
      hideChip() { $("#kt-chip").classList.remove("on"); $("#kt-bar").style.width = "0"; try { sessionStorage.removeItem("kt.chip"); } catch {} },
      end(url) {
        $("#kt-end small").textContent = url;
        $("#kt-end").classList.add("on");
        $("#kt-cursor").style.opacity = "0";
      },
    };
    // restore across hard navigations
    try {
      const cap = JSON.parse(sessionStorage.getItem("kt.cap") || "null");
      const chip = JSON.parse(sessionStorage.getItem("kt.chip") || "null");
      if (chip) window.__kt.chip(...chip);
      if (cap) window.__kt.caption(...cap);
      if (cap || chip) window.__kt.reveal();
    } catch {}
  };
  if (document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount);
};

/* ---------- driver helpers ---------- */
const TOTAL = 8;
const cues = []; // { start, end, title, sub }
const chapters = []; // { start, title }
let t0 = 0;
let curCue = null;
const now = () => (Date.now() - t0) / 1000;
let page;
let pos = { x: 640, y: 360 };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function moveTo(x, y, ms = 750) {
  const dx = x - pos.x, dy = y - pos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(140, dist * 0.22) * (Math.sign(dx * dy) || 1);
  const cx = pos.x + dx / 2 + (-dy / dist) * bend;
  const cy = pos.y + dy / 2 + (dx / dist) * bend;
  const dur = Math.max(ms < 600 ? 420 : 600, Math.min(900, ms));
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / dur);
    const e = ease(t);
    const px = (1 - e) * (1 - e) * pos.x + 2 * (1 - e) * e * cx + e * e * x;
    const py = (1 - e) * (1 - e) * pos.y + 2 * (1 - e) * e * cy + e * e * y;
    await page.mouse.move(px, py);
    if (t >= 1) break;
    await sleep(16);
  }
  pos = { x, y };
}
const centre = async (loc, dx = 0, dy = 0) => {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(150);
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box for " + loc);
  return { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
};
async function hover(loc, ms = 750, dx = 0, dy = 0) {
  const p = await centre(loc, dx, dy);
  await moveTo(p.x, p.y, ms);
}
async function click(loc, ms = 750) {
  await hover(loc, ms);
  const q = ms < 600 ? 0.6 : 1;
  await sleep(220 * q);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(250 * q);
}
async function smoothScroll(y, wait = 1000) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
  await sleep(wait);
}
const vis = (sel) => page.locator(`${sel}:visible`).first();

let capTop = false;
async function caption(title, sub, top = false) {
  if (top !== capTop && curCue) {
    await page.evaluate(() => window.__kt.hideCaption());
    await sleep(500);
  }
  capTop = top;
  if (curCue) curCue.end = now();
  curCue = { start: now() + 0.15, end: 0, title, sub: sub || "" };
  cues.push(curCue);
  await page.evaluate(([t, s, p]) => window.__kt.caption(t, s, p), [title, sub || "", top]);
}
async function clearCaption() {
  if (curCue) curCue.end = now();
  curCue = null;
  await page.evaluate(() => window.__kt.hideCaption());
  await sleep(500);
}
async function scene(n, label) {
  chapters.push({ start: now(), title: label });
  await page.evaluate(([n, l]) => window.__kt.chip(n, 8, l), [n, label]);
}
async function dwell(ms) { await sleep(ms); }

/* ---------- storyboard ---------- */
async function main() {
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    permissions: ["clipboard-read", "clipboard-write"],
    recordVideo: { dir: WORK, size: { width: 1280, height: 720 } },
  });
  await ctx.addInitScript(OVERLAY);
  const tPage = Date.now();
  page = await ctx.newPage();
  page.on("pageerror", (e) => console.warn("pageerror:", e.message));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="nav-explore"]', { state: "attached" });
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await sleep(1500);
  // brand-consistent state: dark + lime
  await page.evaluate(() => { window.scrollTo(0, 0); });
  t0 = Date.now();
  const trim = (t0 - tPage) / 1000 - 0.1;
  await page.evaluate(() => window.__kt.reveal());
  await sleep(700);

  // 1 Home
  await scene(1, "Welcome");
  await caption("Kinetic: remix any idea in one click", "See it. Remix it. Make it yours.");
  await moveTo(560, 330, 800);
  await dwell(1000);
  await moveTo(430, 470, 700);
  await dwell(800);
  await smoothScroll(480, 1100);
  await dwell(700);
  await smoothScroll(0, 700);

  // 2 Search
  await scene(2, "Search");
  await caption("Press ⌘K to find anything", "Models, prompts, pages and help in one search.");
  await hover(vis('[data-testid="search-trigger"]'), 800);
  await dwell(500);
  await page.keyboard.press("Control+k");
  await page.waitForSelector('[data-testid="search-input"]');
  await dwell(700);
  await page.keyboard.type("kling", { delay: 160 });
  await dwell(1400);
  await page.keyboard.press("Escape");
  await dwell(500);

  // 3 Explore
  await scene(3, "Explore");
  await caption("Explore what the community makes", "Hover any card to see its motion. Remix reuses the prompt.");
  await click(vis('[data-testid="nav-explore"]'));
  await page.waitForSelector('[data-testid="feed-card"]');
  await dwell(1200);
  const card = page.locator('[data-testid="feed-card"]:visible').nth(1);
  await hover(card, 800);
  await dwell(2400);
  await click(card.locator('[data-testid="remix-btn"]'), 700);
  await page.waitForURL(/\/create/);
  await page.waitForSelector('[data-testid="prompt-input"]');

  // 4 Create
  await scene(4, "Create");
  await caption("Your prompt is already filled in", "Pick a model, polish the prompt, then generate.", true);
  await dwell(1800);
  const models = page.locator('[data-testid="model-select"] option');
  const nOpt = await models.count();
  await click(page.locator('[data-testid="model-select"]'), 800);
  await page.selectOption('[data-testid="model-select"]', { index: Math.min(1, nOpt - 1) });
  await dwell(1000);
  await caption("Enhance adds cinematic detail", "One click turns a short idea into a richer prompt.", true);
  await click(page.locator('[data-testid="enhance-btn"]'), 800);
  await dwell(1800);
  await caption("Press Generate", "Credits are shown before you spend them.", true);
  await dwell(900);
  await click(page.locator('[data-testid="generate-btn"]'), 800);
  await page.waitForSelector('[data-testid="job-progress"]', { timeout: 20000 }).catch(() => {});
  await caption("Live progress, no black box", "Queued, understanding, rendering, finishing.", true);
  await moveTo(1000, 420, 700);
  await page.waitForSelector('[data-testid="result-card"]', { timeout: 120000 }); // real latency, not faked
  await dwell(1200);

  // 5 Result
  await scene(5, "Result");
  await caption("Done. Download, share or animate it", "Every result is saved to your Library automatically.", true);
  await smoothScroll(140, 900);
  await hover(page.locator('a[download]').first(), 800);
  await dwell(900);
  await hover(page.locator('[data-testid="share-btn"]'), 600);
  if (await page.locator('[data-testid="to-video-btn"]').count()) {
    await hover(page.locator('[data-testid="to-video-btn"]'), 700);
    await caption("Make a video from this image", "Turn any still into motion with one more click.", true);
    await dwell(1700);
  } else await dwell(1200);

  // 6 Library + usage
  await scene(6, "Library & usage");
  await caption("Everything you make lives in your Library", "Re-run, download or delete. Nothing leaves your device.");
  await click(vis('[data-testid="nav-library"]'));
  await page.waitForSelector('[data-testid="library-item"]', { timeout: 15000 }).catch(() => {});
  await dwell(1100);
  await caption("Track credits in the usage dashboard", "See spend by day and by model, and set a budget.");
  await page.goto(BASE + "/usage", { waitUntil: "networkidle" });
  await dwell(800);
  await moveTo(700, 360, 700);
  await smoothScroll(110, 800);
  await dwell(900);
  await smoothScroll(0, 600);

  // 7 Theme + colour
  await scene(7, "Make it yours");
  await caption("Light or dark, your call", "Switch the theme instantly. It is remembered.");
  await click(vis('[data-testid="theme-toggle"]'));
  await page.waitForSelector('[data-testid="theme-menu"]');
  await dwell(500);
  await click(page.locator('[data-testid="theme-option-light"]'), 500);
  await dwell(1200);
  await caption("Pick any accent colour", "Drag the picker. Contrast is checked for you.");
  await page.keyboard.press("Escape");
  await click(vis('[data-testid="accent-switcher"]'));
  const sv = page.locator('[data-testid="accent-sv-area"]');
  await sv.waitFor();
  await sleep(700); // let the popover finish placing/animating before measuring
  const b = await sv.boundingBox();
  await moveTo(b.x + b.width * 0.82, b.y + b.height * 0.25, 700);
  await page.mouse.down();
  for (const [fx, fy] of [[0.55, 0.3], [0.3, 0.5], [0.6, 0.6], [0.8, 0.3]]) {
    await moveTo(b.x + b.width * fx, b.y + b.height * fy, 450);
  }
  await page.mouse.up();
  await dwell(700);
  await dwell(500);
  // restore the brand look: lime + dark
  await click(page.locator('[data-testid="accent-reset"]'), 500);
  await page.keyboard.press("Escape");
  await click(vis('[data-testid="theme-toggle"]'), 500);
  await click(page.locator('[data-testid="theme-option-dark"]'), 500);
  await dwell(800);

  // 8 Connect + end card
  await scene(8, "Connect to Claude");
  await caption("Connect Kinetic to Claude", "Copy one command and your agent can search and generate.");
  await page.goto(BASE + "/connect", { waitUntil: "networkidle" });
  await dwell(500);
  await smoothScroll(340, 700);
  await click(page.locator('[data-testid="mcp-copy-claude-code"]'), 800);
  await dwell(1200);
  await caption("Ready when you are", "Start creating in seconds. No signup needed.");
  await dwell(2200);
  await clearCaption();
  await page.evaluate((u) => { window.__kt.hideChip(); window.__kt.end(u); }, BASE.replace(/^https?:\/\//, ""));
  const endAt = now();
  cues.push({ start: endAt + 0.9, end: endAt + 2.8, title: "Kinetic: see it, remix it, make it yours.", sub: "" });
  await dwell(3000);
  const dur = now();

  const vpath = await page.video().path();
  await ctx.close();
  await browser.close();
  return { vpath, trim, dur };
}

/* ---------- outputs ---------- */
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
function writeVtt({ dur }) {
  fs.mkdirSync(OUT, { recursive: true });
  const body = cues
    .filter((c) => c.end > c.start)
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.min(c.end, dur))}\n${c.title}${c.sub ? "\n" + c.sub : ""}\n`)
    .join("\n");
  fs.writeFileSync(path.join(OUT, "kinetic-tour.vtt"), `WEBVTT\n\n${body}`);
  const ch = chapters
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(i + 1 < chapters.length ? chapters[i + 1].start : dur)}\n${c.title}\n`)
    .join("\n");
  fs.writeFileSync(path.join(OUT, "chapters.vtt"), `WEBVTT\n\n${ch}`);
}
function encode({ vpath, trim, dur }) {
  const mp4 = path.join(OUT, "kinetic-tour.mp4");
  const run = (args) => execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  run(["-ss", Math.max(0, trim).toFixed(2), "-i", vpath, "-t", dur.toFixed(2), "-an", "-vf", "scale=1280:720:flags=lanczos,fps=25,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", process.env.TOUR_CRF || "26", "-movflags", "+faststart", mp4]);
  // poster = the opening hero frame with its caption
  const posterAt = 3.2; // home hero with the opening caption
  run(["-ss", posterAt.toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "3", path.join(OUT, "kinetic-tour.jpg")]);
  console.log("mp4 bytes:", fs.statSync(mp4).size, "duration:", dur.toFixed(1) + "s");
}

const res = await main();
writeVtt(res);
encode(res);
if (process.env.TOUR_KEEP) console.log("raw webm:", res.vpath);
else fs.rmSync(WORK, { recursive: true, force: true });
console.log("done ->", OUT);
