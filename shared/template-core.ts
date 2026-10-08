// Pure template logic (no zod) — shared by the client and the Worker.
import type { InvoiceData } from "./invoice";
import type { TemplateData } from "./templates";

export const TEMPLATE_PARTS = ["business", "client", "items", "adjustments", "notes", "settings"] as const;
export type TemplatePart = (typeof TEMPLATE_PARTS)[number];

export const TEMPLATE_PART_INFO: Record<TemplatePart, { label: string; detail: string }> = {
  business: { label: "your business", detail: "From details & logo" },
  client: { label: "client & project", detail: "Bill-to details, project name" },
  items: { label: "line items", detail: "Descriptions, quantities, rates" },
  adjustments: { label: "tax & discount", detail: "Tax rate, discount, shipping" },
  notes: { label: "notes & terms", detail: "Payment info, notes, terms" },
  settings: { label: "currency, terms & style", detail: "Currency, payment terms, layout & colour" },
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Snapshot the chosen parts of an invoice. */
export function extractTemplate(inv: InvoiceData, parts: readonly TemplatePart[]): TemplateData {
  const has = (p: TemplatePart) => parts.includes(p);
  return {
    parts: TEMPLATE_PARTS.filter(has),
    ...(has("business") && { from: inv.from, logo: inv.style.logo }),
    ...(has("client") && { to: inv.to, ...(inv.project?.trim() && { project: inv.project.trim() }) }),
    ...(has("items") && { items: inv.items.filter((i) => i.description.trim() || i.rate > 0) }),
    ...(has("adjustments") && { taxRate: inv.taxRate, discount: inv.discount, shipping: inv.shipping }),
    ...(has("notes") && { notes: inv.notes, paymentInfo: inv.paymentInfo, terms: inv.terms }),
    ...(has("settings") && {
      currency: inv.currency,
      // A custom due date becomes "due in N days" so it stays meaningful on future invoices.
      termsDays: inv.termsDays ?? Math.min(365, Math.max(0, daysBetween(inv.issueDate, inv.dueDate))),
      layout: inv.style.layout,
      ...(inv.style.accent && { accent: inv.style.accent }),
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
  if (t.project !== undefined) inv.project = t.project;
  if (t.items?.length) inv.items = t.items.map((i) => ({ ...i, id: newId() }));
  if (t.taxRate !== undefined) inv.taxRate = t.taxRate;
  if (t.discount) inv.discount = { ...t.discount };
  if (t.shipping !== undefined) inv.shipping = t.shipping;
  if (t.notes !== undefined) inv.notes = t.notes;
  if (t.paymentInfo !== undefined) inv.paymentInfo = t.paymentInfo;
  if (t.terms !== undefined) inv.terms = t.terms;
  if (t.currency) inv.currency = t.currency;
  if (t.layout) inv.style.layout = t.layout;
  if (t.accent) inv.style.accent = t.accent;
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
