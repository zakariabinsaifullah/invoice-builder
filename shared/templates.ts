import { z } from "zod";
import { discountSchema, invoiceSchema, lineItemSchema, partySchema } from "./invoice";
import { TEMPLATE_PARTS } from "./template-core";

export * from "./template-core";

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
  layout: invoiceSchema.shape.style.shape.layout.optional(),
  accent: invoiceSchema.shape.style.shape.accent,
});
export type TemplateData = z.infer<typeof templateDataSchema>;

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
