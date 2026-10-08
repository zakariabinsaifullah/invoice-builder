import { Hono } from "hono";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  formatInvoiceNumber,
  invoiceStatusSchema,
  invoiceWriteSchema,
  parseInvoiceNumber,
  type InvoiceRecord,
  type InvoiceSummary,
  type InvoiceWrite,
} from "../../shared/api";
import { computeTotals } from "../../shared/money";
import { invoice, profile } from "../db/schema";
import { chunk, getDb, isUniqueViolation, readJson, type AppEnv, type Db } from "../lib";
import { loadProfile } from "./profile";

type Row = typeof invoice.$inferSelect;

const summary = (r: Row): InvoiceSummary => ({
  id: r.id,
  number: r.number,
  status: r.status,
  issueDate: r.issueDate,
  dueDate: r.dueDate,
  currency: r.currency,
  clientName: r.clientName,
  totalMinor: r.totalMinor,
  createdAt: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
});

const record = (r: Row): InvoiceRecord => ({ ...summary(r), data: JSON.parse(r.dataJson), templateId: r.templateId });

/** Denormalized columns derived from the payload (searchable / sortable without parsing JSON). */
function columns(body: InvoiceWrite) {
  const d = body.data;
  return {
    number: d.number.trim(),
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    currency: d.currency,
    clientName: d.to.name.trim(),
    totalMinor: computeTotals(d).total,
    dataJson: JSON.stringify({ ...d, number: d.number.trim() }),
    ...(body.status && { status: body.status }),
    ...(body.templateId !== undefined && { templateId: body.templateId }),
  };
}

/**
 * Statement that advances the user's counter past `number` when it follows their numbering pattern.
 * Wrapped in an object on purpose: Drizzle queries are thenables, so returning one bare from an
 * async function would execute it immediately instead of handing it to the batch.
 */
async function bumpCounter(db: Db, userId: string, number: string, issueDate: string) {
  const { profile: p } = await loadProfile(db, userId);
  const n = parseInvoiceNumber(p, number, Number(issueDate.slice(0, 4)));
  if (n === null) return { query: null };
  return {
    query: db
      .update(profile)
      .set({ nextNumber: sql`max(${profile.nextNumber}, ${n + 1})` })
      .where(eq(profile.userId, userId)),
  };
}

async function numberTaken(c: { json: (b: unknown, s: 409) => Response }, db: Db, userId: string) {
  const { profile: p, nextNumber } = await loadProfile(db, userId);
  return c.json({ error: "number_taken", message: "You already have an invoice with this number.", suggestion: formatInvoiceNumber(p, nextNumber) }, 409);
}

const listQuery = z.object({
  status: invoiceStatusSchema.optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const invoiceRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
    const { status, q, limit } = parsed.data;
    const userId = c.var.user.id;
    const term = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
    const rows = await getDb(c.env)
      .select()
      .from(invoice)
      .where(
        and(
          eq(invoice.userId, userId),
          status ? eq(invoice.status, status) : undefined,
          term ? or(like(invoice.number, term), like(invoice.clientName, term)) : undefined,
        ),
      )
      .orderBy(desc(invoice.updatedAt))
      .limit(limit);
    return c.json({ invoices: rows.map(summary) });
  })

  .post("/bulk-delete", async (c) => {
    const body = await readJson(c, z.object({ ids: z.array(z.string()).min(1).max(500) }));
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    const [first, ...rest] = chunk(body.ids).map((ids) =>
      db
        .delete(invoice)
        .where(and(eq(invoice.userId, c.var.user.id), inArray(invoice.id, ids)))
        .returning({ id: invoice.id }),
    );
    const results = await db.batch([first, ...rest]);
    return c.json({ deleted: results.flat().map((r) => r.id) });
  })

  .get("/:id", async (c) => {
    const row = await getDb(c.env)
      .select()
      .from(invoice)
      .where(and(eq(invoice.id, c.req.param("id")), eq(invoice.userId, c.var.user.id)))
      .get();
    return row ? c.json(record(row)) : c.json({ error: "not_found" }, 404);
  })

  .post("/", async (c) => {
    const body = await readJson(c, invoiceWriteSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    const userId = c.var.user.id;
    const cols = columns(body);
    if (!cols.number) return c.json({ error: "number_required" }, 400);

    const id = crypto.randomUUID();
    const insert = db.insert(invoice).values({ id, userId, ...cols });
    const { query: bump } = await bumpCounter(db, userId, cols.number, cols.issueDate);
    try {
      // Batch = one transaction: the counter only advances if the insert succeeds.
      if (bump) await db.batch([insert, bump]);
      else await insert;
    } catch (err) {
      if (isUniqueViolation(err)) return numberTaken(c, db, userId);
      throw err;
    }
    const row = (await db.select().from(invoice).where(eq(invoice.id, id)).get())!;
    return c.json(record(row), 201);
  })

  .put("/:id", async (c) => {
    const body = await readJson(c, invoiceWriteSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    const userId = c.var.user.id;
    const id = c.req.param("id");
    const cols = columns(body);
    if (!cols.number) return c.json({ error: "number_required" }, 400);

    const where = and(eq(invoice.id, id), eq(invoice.userId, userId));
    const update = db.update(invoice).set({ ...cols, updatedAt: new Date() }).where(where);
    const { query: bump } = await bumpCounter(db, userId, cols.number, cols.issueDate);
    try {
      if (bump) await db.batch([update, bump]);
      else await update;
    } catch (err) {
      if (isUniqueViolation(err)) return numberTaken(c, db, userId);
      throw err;
    }
    const row = await db.select().from(invoice).where(where).get();
    return row ? c.json(record(row)) : c.json({ error: "not_found" }, 404);
  })

  .patch("/:id/status", async (c) => {
    const body = await readJson(c, z.object({ status: invoiceStatusSchema }));
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    const where = and(eq(invoice.id, c.req.param("id")), eq(invoice.userId, c.var.user.id));
    await db.update(invoice).set({ status: body.status, updatedAt: new Date() }).where(where);
    const row = await db.select().from(invoice).where(where).get();
    return row ? c.json(summary(row)) : c.json({ error: "not_found" }, 404);
  })

  .delete("/:id", async (c) => {
    const res = await getDb(c.env)
      .delete(invoice)
      .where(and(eq(invoice.id, c.req.param("id")), eq(invoice.userId, c.var.user.id)))
      .returning({ id: invoice.id });
    return res.length ? c.body(null, 204) : c.json({ error: "not_found" }, 404);
  });
