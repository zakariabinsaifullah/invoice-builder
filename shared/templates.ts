import { z } from "zod";
import { discountSchema, invoiceSchema, lineItemSchema, partySchema, type InvoiceData } from "./invoice";

export const TEMPLATE_PARTS = ["business", "client", "items", "adjustments", "notes", "settings"] as const;
export type TemplatePart = (typeof TEMPLATE_PARTS)[number];

export const TEMPLATE_PART_INFO: Record<TemplatePart, { label: string; detail: string }> = {
  business: { label: "your business", detail: "From details & logo" },
  client: { label: "client", detail: "Bill-to details" },
  items: { label: "line items", detail: "Descriptions, quantities, rates" },
  adjustments: { label: "tax & discount", detail: "Tax rate, discount, shipping" },
  notes: { label: "notes & terms", detail: "Payment info, notes, terms" },
  settings: { label: "currency & terms", detail: "Currency, payment terms" },
};

/** Saved parts of an invoice. Anything not saved comes from the user's defaults when the template is used. */
export const templateDataSchema = z.object({
  parts: z.array(z.enum(TEMPLATE_PARTS)).min(1),
  from: partySchema.optional(),
  logo: invoiceSchema.shape.style.shape.logo.optional(),
  to: partySchema.optional(),
  items: z.array(lineItemSchema).max(200).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: discountSchema.optional(),
  shipping: z.number().min(0).max(1e12).optional(),
  notes: z.string().max(2000).optional(),
  paymentInfo: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  currency: z.string().length(3).optional(),
  termsDays: z.number().int().min(0).max(365).optional(),
});
export type TemplateData = z.infer<typeof templateDataSchema>;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Snapshot the chosen parts of an invoice. */
export function extractTemplate(inv: InvoiceData, parts: readonly TemplatePart[]): TemplateData {
  const has = (p: TemplatePart) => parts.includes(p);
  return {
    parts: TEMPLATE_PARTS.filter(has),
    ...(has("business") && { from: inv.from, logo: inv.style.logo }),
    ...(has("client") && { to: inv.to }),
    ...(has("items") && { items: inv.items.filter((i) => i.description.trim() || i.rate > 0) }),
    ...(has("adjustments") && { taxRate: inv.taxRate, discount: inv.discount, shipping: inv.shipping }),
    ...(has("notes") && { notes: inv.notes, paymentInfo: inv.paymentInfo, terms: inv.terms }),
    ...(has("settings") && {
      currency: inv.currency,
      // A custom due date becomes "due in N days" so it stays meaningful on future invoices.
      termsDays: inv.termsDays ?? Math.min(365, Math.max(0, daysBetween(inv.issueDate, inv.dueDate))),
    }),
  };
}

/**
 * Overlay a template on a fresh invoice (which already carries today's date, the next number and
 * the user's defaults). Items get new ids; the due date is recomputed from the payment terms.
 */
export function applyTemplate(base: InvoiceData, t: TemplateData, newId: () => string): InvoiceData {
  const inv: InvoiceData = { ...base, style: { ...base.style } };
  if (t.from) inv.from = { ...t.from };
  if (t.logo !== undefined) inv.style.logo = t.logo;
  if (t.to) inv.to = { ...t.to };
  if (t.items?.length) inv.items = t.items.map((i) => ({ ...i, id: newId() }));
  if (t.taxRate !== undefined) inv.taxRate = t.taxRate;
  if (t.discount) inv.discount = { ...t.discount };
  if (t.shipping !== undefined) inv.shipping = t.shipping;
  if (t.notes !== undefined) inv.notes = t.notes;
  if (t.paymentInfo !== undefined) inv.paymentInfo = t.paymentInfo;
  if (t.terms !== undefined) inv.terms = t.terms;
  if (t.currency) inv.currency = t.currency;
  if (t.termsDays !== undefined) {
    inv.termsDays = t.termsDays;
    const d = new Date(Date.parse(inv.issueDate) + t.termsDays * 86_400_000);
    inv.dueDate = d.toISOString().slice(0, 10);
  }
  return inv;
}

/** Suggested template name for an invoice. */
export function defaultTemplateName(inv: InvoiceData): string {
  const client = inv.to.name.trim();
  const first = inv.items.find((i) => i.description.trim())?.description.trim();
  if (client && first) return `${client} — ${first}`.slice(0, 80);
  return (client || first || `Template from ${inv.number}`).slice(0, 80);
}

// ── API shapes ────────────────────────────────────────────────────────────

const tagsSchema = z.array(z.string().trim().min(1).max(24)).max(8);

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tags: tagsSchema.default([]),
  pinned: z.boolean().default(false),
  data: templateDataSchema,
});

export const templateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tags: tagsSchema.optional(),
  pinned: z.boolean().optional(),
  data: templateDataSchema.optional(),
});

export const templatesFromInvoicesSchema = z.object({
  invoiceIds: z.array(z.string()).min(1).max(50),
  parts: z.array(z.enum(TEMPLATE_PARTS)).min(1),
  tags: tagsSchema.default([]),
});

export type TemplateSummary = {
  id: string;
  name: string;
  tags: string[];
  pinned: boolean;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Template content without the logo (kept small for the gallery). */
  preview: Omit<TemplateData, "logo">;
  hasLogo: boolean;
};

export type TemplateRecord = TemplateSummary & { data: TemplateData };

export const MAX_TEMPLATES = 200;
