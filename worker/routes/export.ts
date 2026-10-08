import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { client, invoice, template } from "../db/schema";
import { getDb, type AppEnv } from "../lib";
import { loadProfile } from "./profile";

/** Everything the user owns, as one JSON download. */
export const exportRoute = new Hono<AppEnv>().get("/", async (c) => {
  const db = getDb(c.env);
  const userId = c.var.user.id;
  const [profile, clients, invoices, templates] = await Promise.all([
    loadProfile(db, userId),
    db.select().from(client).where(eq(client.userId, userId)),
    db.select().from(invoice).where(eq(invoice.userId, userId)).orderBy(desc(invoice.issueDate)),
    db.select().from(template).where(eq(template.userId, userId)),
  ]);
  const strip = <T extends { userId: string }>({ userId: _, ...rest }: T) => rest;
  const body = {
    app: "invoice-builder",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { name: c.var.user.name, email: c.var.user.email },
    profile,
    clients: clients.map(strip),
    invoices: invoices.map(({ dataJson, ...r }) => ({ ...strip(r), data: JSON.parse(dataJson) })),
    templates: templates.map(({ dataJson, tagsJson, ...r }) => ({ ...strip(r), tags: JSON.parse(tagsJson), data: JSON.parse(dataJson) })),
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="invoice-builder-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
});
