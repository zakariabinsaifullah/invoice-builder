import { Hono } from "hono";
import { and, asc, count, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { partySchema, type Party } from "../../shared/invoice";
import type { ClientSummary } from "../../shared/api";
import { client, invoice } from "../db/schema";
import { getDb, readJson, type AppEnv, type Db } from "../lib";

const clientBody = partySchema.extend({ name: z.string().trim().min(1).max(200) });

type Row = typeof client.$inferSelect;
const toParty = (r: Row): Party => ({ name: r.name, email: r.email, phone: r.phone, address: r.address, taxId: r.taxId });

/** Save a bill-to party as a client the first time its name is used (case-insensitive). Best effort. */
export async function rememberClient(db: Db, userId: string, to: Party) {
  const name = to.name.trim();
  if (!name) return;
  try {
    const existing = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.userId, userId), sql`lower(${client.name}) = lower(${name})`))
      .get();
    if (!existing) await db.insert(client).values({ id: crypto.randomUUID(), userId, ...to, name });
  } catch (err) {
    console.error("rememberClient failed", err);
  }
}

export const clientRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const db = getDb(c.env);
    const userId = c.var.user.id;
    const [rows, stats] = await Promise.all([
      db.select().from(client).where(eq(client.userId, userId)).orderBy(asc(sql`lower(${client.name})`)),
      db
        .select({ name: sql<string>`lower(${invoice.clientName})`, n: count(), last: max(invoice.issueDate) })
        .from(invoice)
        .where(eq(invoice.userId, userId))
        .groupBy(sql`lower(${invoice.clientName})`),
    ]);
    const byName = new Map(stats.map((s) => [s.name, s]));
    const clients: ClientSummary[] = rows.map((r) => {
      const s = byName.get(r.name.toLowerCase());
      return { id: r.id, ...toParty(r), invoiceCount: s?.n ?? 0, lastInvoiceDate: s?.last ?? null };
    });
    return c.json({ clients });
  })

  .post("/", async (c) => {
    const body = await readJson(c, clientBody);
    if (body instanceof Response) return body;
    const [row] = await getDb(c.env)
      .insert(client)
      .values({ id: crypto.randomUUID(), userId: c.var.user.id, ...body })
      .returning();
    return c.json({ id: row.id, ...toParty(row), invoiceCount: 0, lastInvoiceDate: null }, 201);
  })

  .put("/:id", async (c) => {
    const body = await readJson(c, clientBody);
    if (body instanceof Response) return body;
    const [row] = await getDb(c.env)
      .update(client)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(client.id, c.req.param("id")), eq(client.userId, c.var.user.id)))
      .returning();
    return row ? c.json({ id: row.id, ...toParty(row) }) : c.json({ error: "not_found" }, 404);
  })

  .delete("/:id", async (c) => {
    const res = await getDb(c.env)
      .delete(client)
      .where(and(eq(client.id, c.req.param("id")), eq(client.userId, c.var.user.id)))
      .returning({ id: client.id });
    return res.length ? c.body(null, 204) : c.json({ error: "not_found" }, 404);
  });
