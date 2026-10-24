// Applies drizzle migrations over Neon's HTTPS (port 443) endpoint. Use when raw Postgres
// (port 5432) is blocked by a corporate firewall/proxy. The app itself still uses postgres-js.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? readFileSync(".env.local", "utf8").match(/^DATABASE_URL_NEON=(.+)$/m)?.[1];
if (!url) throw new Error("No Neon URL (set DATABASE_URL or DATABASE_URL_NEON in .env.local)");
const sql = neon(url);
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
const [{ n }] = await sql`select count(*)::int as n from information_schema.tables where table_schema='public'`;
const [{ v }] = await sql`select version() as v`;
console.log(`Migrated. public tables: ${n}. ${v.slice(0, 40)}`);
