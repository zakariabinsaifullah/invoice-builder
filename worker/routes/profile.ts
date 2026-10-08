import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_PROFILE, formatInvoiceNumber, profileSchema, profileUpdateSchema, type ProfileResponse } from "../../shared/api";
import { profile } from "../db/schema";
import { getDb, readJson, type AppEnv, type Db } from "../lib";
import { externalizeLogo } from "../logos";

/** Loads the user's profile row, creating it with defaults on first use. */
export async function loadProfile(db: Db, userId: string) {
  await db
    .insert(profile)
    .values({ userId, dataJson: JSON.stringify(DEFAULT_PROFILE) })
    .onConflictDoNothing();
  const row = (await db.select().from(profile).where(eq(profile.userId, userId)).get())!;
  // Merge over defaults so profiles saved before a field existed still parse.
  const parsed = profileSchema.safeParse({ ...DEFAULT_PROFILE, ...JSON.parse(row.dataJson) });
  return { profile: parsed.success ? parsed.data : DEFAULT_PROFILE, nextNumber: row.nextNumber };
}

const toResponse = (p: Awaited<ReturnType<typeof loadProfile>>): ProfileResponse => ({
  ...p,
  nextInvoiceNumber: formatInvoiceNumber(p.profile, p.nextNumber),
});

export const profileRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(toResponse(await loadProfile(getDb(c.env), c.var.user.id))))
  .put("/", async (c) => {
    const body = await readJson(c, profileUpdateSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    await loadProfile(db, c.var.user.id); // ensure row
    body.profile.logo = await externalizeLogo(c.env, db, c.var.user.id, body.profile.logo);
    await db
      .update(profile)
      .set({
        dataJson: JSON.stringify(body.profile),
        ...(body.nextNumber !== undefined && { nextNumber: body.nextNumber }),
        updatedAt: sql`(unixepoch() * 1000)`,
      })
      .where(eq(profile.userId, c.var.user.id));
    return c.json(toResponse(await loadProfile(db, c.var.user.id)));
  });
