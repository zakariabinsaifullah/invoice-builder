import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { z } from "zod";
import type { SessionUser } from "./auth";
import * as schema from "./db/schema";

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };

export const getDb = (env: Env) => drizzle(env.DB, { schema });
export type Db = ReturnType<typeof getDb>;

const MAX_BODY = 1_500_000; // bytes; invoices may embed a PNG logo

/** Parse and validate a JSON body; returns the data or a ready-to-return error Response. */
export async function readJson<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.infer<S> | Response> {
  if (Number(c.req.header("content-length") ?? 0) > MAX_BODY) return c.json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues.slice(0, 10) }, 400);
  return parsed.data;
}

/** True if any error in the cause chain is a SQLite UNIQUE violation (Drizzle wraps the D1 error). */
export function isUniqueViolation(err: unknown): boolean {
  for (let e = err as { message?: string; cause?: unknown } | undefined, i = 0; e && i < 5; e = e.cause as typeof e, i++) {
    if (String(e.message ?? e).includes("UNIQUE constraint failed")) return true;
  }
  return false;
}
