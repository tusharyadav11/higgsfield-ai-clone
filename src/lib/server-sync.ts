"use client";
// Client glue for server-backed accounts. When the signed-in user has `server: true`, Postgres is the
// source of truth and the zustand store is only a cache that these helpers keep in sync.
import { useStore, type ServerMe } from "./store";
import { useServerInfo } from "./server-info";

type Me = { db: boolean; user: ServerMe["user"] | null } & Partial<Omit<ServerMe, "user">>;

export type ApiResult<T> = { ok: boolean; status: number; data: T & { error?: string; field?: string; demo?: boolean } };

export async function api<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error" } as ApiResult<T>["data"] };
  }
}

let inflight: Promise<void> | null = null;

/** Pulls /api/me into the store. No cookie => cheap {user:null}. A dead session resets to guest. */
export function hydrate(): Promise<void> {
  inflight ??= (async () => {
    const r = await api<Me>("/api/me");
    if (!r.ok && r.status !== 200) return; // transient failure: keep the cache
    const st = useStore.getState();
    const me = r.data;
    useServerInfo.getState().setDb(!!me.db);
    if (me.user && me.balance !== undefined) st.applyServer(me as ServerMe);
    else if (st.user?.server) st.signOut(); // session expired / logged out elsewhere
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export const isServerUser = () => !!useStore.getState().user?.server;

export async function claimServer(): Promise<{ ok: boolean; gained: number }> {
  const r = await api<{ ok: boolean; gained: number; balance: number; streak: number; lastClaim: string }>("/api/me/claim", "POST");
  if (r.status === 401) {
    await hydrate();
    return { ok: false, gained: 0 };
  }
  if (typeof r.data.balance === "number") useStore.setState({ credits: r.data.balance, streak: r.data.streak, lastClaim: r.data.lastClaim });
  return { ok: !!r.data.ok, gained: r.data.gained ?? 0 };
}

export async function logout(): Promise<void> {
  if (isServerUser()) await api("/api/auth/logout", "POST");
  useStore.getState().signOut();
}

/** Called right after a successful server signup/login: merge the guest's local data (signup only), then pull the account. */
export async function afterAuth(opts: { importGuest: boolean }): Promise<void> {
  const st = useStore.getState();
  if (opts.importGuest && !st.user?.server) {
    await api("/api/me/import", "POST", { library: st.library, credits: st.credits, likes: Object.keys(st.likes) });
  }
  await hydrate();
}
