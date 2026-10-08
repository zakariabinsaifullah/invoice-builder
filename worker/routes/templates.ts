import { Hono } from "hono";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  defaultTemplateName,
  extractTemplate,
  MAX_TEMPLATES,
  templateCreateSchema,
  templatesFromInvoicesSchema,
  templateUpdateSchema,
  type TemplateData,
  type TemplateRecord,
  type TemplateSummary,
} from "../../shared/templates";
import type { InvoiceData } from "../../shared/invoice";
import { invoice, template } from "../db/schema";
import { getDb, readJson, type AppEnv, type Db } from "../lib";
import { externalizeLogo } from "../logos";

type Row = typeof template.$inferSelect;

function summary(r: Row): TemplateSummary {
  const { logo, ...preview } = JSON.parse(r.dataJson) as TemplateData;
  return {
    id: r.id,
    name: r.name,
    tags: JSON.parse(r.tagsJson),
    pinned: r.pinned,
    useCount: r.useCount,
    lastUsedAt: r.lastUsedAt?.getTime() ?? null,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
    preview,
    hasLogo: !!logo,
  };
}

const record = (r: Row): TemplateRecord => ({ ...summary(r), data: JSON.parse(r.dataJson) });

async function roomFor(db: Db, userId: string, n: number) {
  const [{ total }] = await db.select({ total: count() }).from(template).where(eq(template.userId, userId));
  return total + n <= MAX_TEMPLATES;
}

const tooMany = { error: "template_limit", message: `You can keep up to ${MAX_TEMPLATES} templates.` };

export const templateRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await getDb(c.env)
      .select()
      .from(template)
      .where(eq(template.userId, c.var.user.id))
      .orderBy(desc(template.pinned), sql`coalesce(${template.lastUsedAt}, ${template.createdAt}) desc`);
    return c.json({ templates: rows.map(summary) });
  })

  .get("/:id", async (c) => {
    const row = await getDb(c.env)
      .select()
      .from(template)
      .where(and(eq(template.id, c.req.param("id")), eq(template.userId, c.var.user.id)))
      .get();
    return row ? c.json(record(row)) : c.json({ error: "not_found" }, 404);
  })

  .post("/", async (c) => {
    const body = await readJson(c, templateCreateSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    if (!(await roomFor(db, c.var.user.id, 1))) return c.json(tooMany, 409);
    body.data.logo = await externalizeLogo(c.env, db, c.var.user.id, body.data.logo);
    const [row] = await db
      .insert(template)
      .values({
        id: crypto.randomUUID(),
        userId: c.var.user.id,
        name: body.name,
        tagsJson: JSON.stringify(body.tags),
        pinned: body.pinned,
        dataJson: JSON.stringify(body.data),
      })
      .returning();
    return c.json(record(row), 201);
  })

  /** Save several invoices as templates in one go. */
  .post("/from-invoices", async (c) => {
    const body = await readJson(c, templatesFromInvoicesSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    const userId = c.var.user.id;
    const invoices = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.userId, userId), inArray(invoice.id, body.invoiceIds)));
    if (!invoices.length) return c.json({ error: "not_found" }, 404);
    if (!(await roomFor(db, userId, invoices.length))) return c.json(tooMany, 409);

    const values = await Promise.all(invoices.map(async (inv) => {
      const data = JSON.parse(inv.dataJson) as InvoiceData;
      data.style.logo = await externalizeLogo(c.env, db, userId, data.style.logo); // older invoices may embed it
      return {
        id: crypto.randomUUID(),
        userId,
        name: defaultTemplateName(data),
        tagsJson: JSON.stringify(body.tags),
        dataJson: JSON.stringify(extractTemplate(data, body.parts)),
      };
    }));
    // One statement per row (D1's 100-parameter cap), all in one transaction.
    const [first, ...rest] = values.map((v) => db.insert(template).values(v).returning());
    const results = await db.batch([first, ...rest]);
    return c.json({ templates: results.flat().map(summary) }, 201);
  })

  .patch("/:id", async (c) => {
    const body = await readJson(c, templateUpdateSchema);
    if (body instanceof Response) return body;
    const db = getDb(c.env);
    if (body.data) body.data.logo = await externalizeLogo(c.env, db, c.var.user.id, body.data.logo);
    const [row] = await db
      .update(template)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.tags !== undefined && { tagsJson: JSON.stringify(body.tags) }),
        ...(body.pinned !== undefined && { pinned: body.pinned }),
        ...(body.data !== undefined && { dataJson: JSON.stringify(body.data) }),
        updatedAt: new Date(),
      })
      .where(and(eq(template.id, c.req.param("id")), eq(template.userId, c.var.user.id)))
      .returning();
    return row ? c.json(record(row)) : c.json({ error: "not_found" }, 404);
  })

  .post("/:id/duplicate", async (c) => {
    const db = getDb(c.env);
    const userId = c.var.user.id;
    const src = await db
      .select()
      .from(template)
      .where(and(eq(template.id, c.req.param("id")), eq(template.userId, userId)))
      .get();
    if (!src) return c.json({ error: "not_found" }, 404);
    if (!(await roomFor(db, userId, 1))) return c.json(tooMany, 409);
    const [row] = await db
      .insert(template)
      .values({
        id: crypto.randomUUID(),
        userId,
        name: `${src.name} (copy)`.slice(0, 80),
        tagsJson: src.tagsJson,
        dataJson: src.dataJson,
      })
      .returning();
    return c.json(record(row), 201);
  })

  /** Record that a template was used; returns the full template to apply. */
  .post("/:id/use", async (c) => {
    const [row] = await getDb(c.env)
      .update(template)
      .set({ useCount: sql`${template.useCount} + 1`, lastUsedAt: new Date() })
      .where(and(eq(template.id, c.req.param("id")), eq(template.userId, c.var.user.id)))
      .returning();
    return row ? c.json(record(row)) : c.json({ error: "not_found" }, 404);
  })

  .delete("/:id", async (c) => {
    const res = await getDb(c.env)
      .delete(template)
      .where(and(eq(template.id, c.req.param("id")), eq(template.userId, c.var.user.id)))
      .returning({ id: template.id });
    return res.length ? c.body(null, 204) : c.json({ error: "not_found" }, 404);
  });
