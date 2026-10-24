// Integration catalogue. Only the MCP-based entries work today; everything else is honestly
// "Planned" / "Not available yet". "Request this integration" stores interest in this browser only.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PillStatus } from "@/components/enterprise/shared/StatusPill";

export const STORE_KEY = "kinetic-ws-integration-interest";
export type Integration = { id: string; name: string; blurb: string; status: PillStatus; statusLabel?: string; href?: string; cta?: string };

export const INTEGRATIONS: Integration[] = [
  { id: "claude-mcp", name: "Claude (MCP)", blurb: "Generate and search Kinetic from Claude through the Model Context Protocol server.", status: "active", statusLabel: "Available", href: "/connect", cta: "Set up on Connect" },
  { id: "cursor-mcp", name: "Cursor / VS Code (MCP)", blurb: "Copy-paste MCP config for Cursor, VS Code and other MCP clients.", status: "active", statusLabel: "Available", href: "/connect", cta: "Get the config" },
  { id: "figma", name: "Figma", blurb: "Send generations to a Figma file.", status: "planned" },
  { id: "adobe", name: "Adobe Premiere / After Effects", blurb: "Pull clips and stills into a timeline.", status: "planned" },
  { id: "frameio", name: "Frame.io", blurb: "Route approved projects into review.", status: "not-available" },
  { id: "slack", name: "Slack", blurb: "Post completed generations and approvals to a channel.", status: "not-available" },
  { id: "notion", name: "Notion", blurb: "Embed project boards and assets in docs.", status: "not-available" },
  { id: "zapier", name: "Zapier", blurb: "Trigger automations from Kinetic events.", status: "not-available" },
];
export const isRequestable = (i: Integration) => !i.href;

export type Interest = { id: string; integration: string; note: string; email: string; at: string };
export const NOTE_MAX = 300;
const EMAIL_RE = /^[^\s@,;<>()[\]]+@[^\s@,;<>()[\]]+\.[^\s@,;<>()[\]]{2,}$/;
export function validateInterest(note: string, email: string): { note?: string; email?: string } {
  const e: { note?: string; email?: string } = {};
  if (note.trim().length > NOTE_MAX) e.note = `Keep the note to ${NOTE_MAX} characters.`;
  if (email.trim() && (email.trim().length > 254 || !EMAIL_RE.test(email.trim()))) e.email = "Enter a valid email address or leave it blank.";
  return e;
}

type State = { interests: Interest[]; add: (i: Omit<Interest, "id">) => void; remove: (integration: string) => void };
export const useInterest = create<State>()(
  persist(
    (set) => ({
      interests: [],
      add: (i) => set((s) => ({ interests: [{ ...i, id: `int-${s.interests.length + 1}-${Date.parse(i.at).toString(36)}` }, ...s.interests.filter((x) => x.integration !== i.integration)] })),
      remove: (integration) => set((s) => ({ interests: s.interests.filter((x) => x.integration !== integration) })),
    }),
    { name: STORE_KEY, version: 1, skipHydration: true, partialize: ({ interests }) => ({ interests }) },
  ),
);
