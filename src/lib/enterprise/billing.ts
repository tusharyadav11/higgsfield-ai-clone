// DEMO billing. There is NO payment provider: nothing is charged, no invoice exists, and plan
// changes are only local intents recorded in this browser. Prices come from ./pricing (plans.ts rules).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeAddons, serializeCalc, type Addons, type Billing } from "./pricing";

export const STORE_KEY = "kinetic-ws-billing";
export type DemoPlan = "enterprise" | "team" | "free";
export const PLAN_LABEL: Record<DemoPlan, string> = { enterprise: "Enterprise (quote pending)", team: "Team (demo)", free: "Free (cancelled in demo)" };
export type IntentKind = "upgrade" | "downgrade" | "cancel";
export type Intent = { id: string; at: string; kind: IntentKind; from: DemoPlan; to: DemoPlan };

/** What a subscription action does to the local demo plan; null = not allowed from this plan. */
export function nextPlan(from: DemoPlan, kind: IntentKind): DemoPlan | null {
  if (kind === "upgrade") return from === "enterprise" ? null : "enterprise";
  if (kind === "downgrade") return from === "enterprise" ? "team" : null;
  return from === "free" ? null : "free";
}
export const intentReason = (from: DemoPlan, kind: IntentKind): string | null =>
  nextPlan(from, kind)
    ? null
    : kind === "upgrade"
      ? "You are already on the highest plan."
      : kind === "downgrade"
        ? from === "team"
          ? "Team is the lowest paid plan. Cancel instead."
          : "There is nothing below the Free plan."
        : "The subscription is already cancelled.";

export const INTENT_LABEL: Record<IntentKind, string> = { upgrade: "Upgrade", downgrade: "Downgrade", cancel: "Cancel" };

export const addonsLink = (seats: number, billing: Billing, addons: Addons) => `/enterprise?${serializeCalc({ seats, billing, addons, expectedCredits: null })}#quote`;

type State = {
  plan: DemoPlan;
  billing: Billing;
  addons: Addons;
  intents: Intent[];
  setBilling: (b: Billing) => void;
  setAddons: (a: Addons) => void;
  recordIntent: (kind: IntentKind, at: string) => Intent | null;
};

export const useBilling = create<State>()(
  persist(
    (set, get) => ({
      plan: "enterprise",
      billing: "annual",
      addons: {},
      intents: [],
      setBilling: (billing) => set({ billing: billing === "monthly" ? "monthly" : "annual" }),
      setAddons: (a) => set({ addons: normalizeAddons(a) }),
      recordIntent: (kind, at) => {
        const from = get().plan;
        const to = nextPlan(from, kind);
        if (!to) return null;
        const intent: Intent = { id: `int-${get().intents.length + 1}-${Date.parse(at).toString(36)}`, at, kind, from, to };
        set((s) => ({ plan: to, intents: [intent, ...s.intents].slice(0, 20) }));
        return intent;
      },
    }),
    { name: STORE_KEY, version: 1, skipHydration: true, partialize: ({ plan, billing, addons, intents }) => ({ plan, billing, addons, intents }) },
  ),
);

