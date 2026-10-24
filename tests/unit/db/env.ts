// Must be the FIRST import of every DB test: points the app's db() at the throwaway test database.
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/kinetic_test";
process.env.DATABASE_URL = TEST_DB_URL;
