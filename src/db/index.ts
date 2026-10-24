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
  g.__pg ??= postgres(process.env.DATABASE_URL, { max: 5, prepare: false, idle_timeout: 20 });
  return drizzle(g.__pg, { schema });
}
export * as t from "./schema";
