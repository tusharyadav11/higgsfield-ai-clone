import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.QA_PORT || 3711);
const ONLY = process.env.DEVQA_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const BROWSERS = (process.env.DEVQA_BROWSERS || "chromium").split(",");

// Built-in registry devices; names that don't exist in this Playwright version are skipped (and logged).
const DEVICE_NAMES = [
  "iPhone SE", "iPhone 13 Mini", "iPhone 14", "iPhone 15 Pro Max", "Pixel 5", "Pixel 7", "Galaxy S9+",
  "Galaxy S8 landscape", "iPad Mini", "iPad (gen 7)", "iPad Pro 11", "Galaxy Tab S4",
];
type Proj = { name: string; use: Record<string, unknown>; engine?: "chromium" | "firefox" | "webkit" };
const chr = (d: Record<string, unknown>) => { const { defaultBrowserType: _b, ...rest } = d; void _b; return rest; };
const projects: Proj[] = [];
for (const n of DEVICE_NAMES) {
  const d = devices[n];
  if (!d) { console.warn(`[devices] unknown device "${n}" skipped`); continue; }
  // Device descriptor emulation (viewport, DPR, UA, touch) on Chromium for speed; engines are covered by the browser projects below.
  projects.push({ name: n, use: chr(d) });
}
projects.push({ name: "Galaxy Fold folded 280x653", use: { ...chr(devices["Pixel 5"]), viewport: { width: 280, height: 653 }, screen: { width: 280, height: 653 }, deviceScaleFactor: 3 } });
projects.push({ name: "Phone landscape 844x390", use: { ...chr(devices["iPhone 14 landscape"]), viewport: { width: 844, height: 390 } } });
const desk = (w: number, h: number, dpr = 1, label = "") => projects.push({ name: `${label || "Desktop"} ${w}x${h}`, use: { viewport: { width: w, height: h }, deviceScaleFactor: dpr } });
desk(1024, 768, 1, "Laptop"); desk(1280, 720); desk(1366, 768, 1, "Windows laptop"); desk(1440, 900, 2, "MacBook Air");
desk(1512, 982, 2, "MacBook Pro 14"); desk(1728, 1117, 2, "MacBook Pro 16"); desk(1920, 1080); desk(2560, 1440);
// colour scheme + reduced motion on a phone
projects.push({ name: "iPhone 14 dark", use: { ...chr(devices["iPhone 14"]), colorScheme: "dark" } });
projects.push({ name: "iPhone 14 light", use: { ...chr(devices["iPhone 14"]), colorScheme: "light" } });
projects.push({ name: "iPhone 14 reduced-motion", use: { ...chr(devices["iPhone 14"]), reducedMotion: "reduce" } });
// engine coverage (desktop + a phone profile per engine); iPhone profile in webkit, Pixel in chromium already above
projects.push({ name: "Firefox 1440x900", engine: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } });
projects.push({ name: "WebKit 1440x900", engine: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } });
projects.push({ name: "WebKit iPhone SE (real engine)", engine: "webkit", use: { ...devices["iPhone SE"] } });
projects.push({ name: "WebKit iPad Pro 11 (real engine)", engine: "webkit", use: { ...devices["iPad Pro 11"] } });

const installed = (b: string) => {
  const dir = path.join(process.env.HOME || "", "Library/Caches/ms-playwright");
  try { return fs.readdirSync(dir).some((f) => f.startsWith(b)); } catch { return true; }
};

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "devices.spec.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: Number(process.env.DEVQA_WORKERS || 4),
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/devices.json" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: projects
    .filter((p) => !ONLY || ONLY.some((o) => p.name.includes(o)))
    .filter((p) => BROWSERS.includes(p.engine ?? "chromium"))
    .filter((p) => installed(p.engine ?? "chromium"))
    .map((p) => ({ name: p.name, use: p.use })),
});
