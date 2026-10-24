import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reused across hot reloads / warm serverless invocations. `prepare:false` keeps it
// compatible with pooled connection strings (Neon / Supabase pooler).
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };

export function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  // postgres-js has no SCRAM channel binding; Neon strings often carry channel_binding=require
  const url = process.env.DATABASE_URL.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");
  g.__pg ??= postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
  return drizzle(g.__pg, { schema });
}
export * as t from "./schema";
