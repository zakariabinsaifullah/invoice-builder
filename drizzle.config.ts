import { defineConfig } from "drizzle-kit";

// Generates SQL into ./migrations; apply with `wrangler d1 migrations apply` (see package.json scripts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./migrations",
});
