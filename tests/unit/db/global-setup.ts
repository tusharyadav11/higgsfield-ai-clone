import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Applies migrations to kinetic_test once per run, or flags that Postgres is unavailable. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/kinetic_test";
  const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    process.env.KINETIC_TEST_DB = "1";
  } catch (e) {
    console.warn(`\n[db tests] SKIPPED: cannot reach/migrate Postgres at ${url} (${(e as Error).message}).\n  Create it with: createdb kinetic_test\n`);
    process.env.KINETIC_TEST_DB = "0";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}
