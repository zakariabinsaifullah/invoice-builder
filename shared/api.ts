import { z } from "zod";
import { invoiceSchema, partySchema } from "./invoice";

// ── Profile: business identity + defaults for new invoices ────────────────

export const profileSchema = z.object({
  business: partySchema,
  logo: invoiceSchema.shape.style.shape.logo,
  currency: z.string().length(3),
  taxRate: z.number().min(0).max(100),
  termsDays: z.number().int().min(0).max(365),
  /** May contain {YYYY}, replaced with the issue year. */
  numberPrefix: z.string().max(30),
  numberPadding: z.number().int().min(1).max(8),
  notes: z.string().max(2000),
  paymentInfo: z.string().max(2000),
  terms: z.string().max(2000),
  layout: invoiceSchema.shape.style.shape.layout,
  accent: invoiceSchema.shape.style.shape.accent,
});

export type Profile = z.infer<typeof profileSchema>;

export const DEFAULT_PROFILE: Profile = {
  business: { name: "", email: "", phone: "", address: "", taxId: "" },
  logo: null,
  currency: "USD",
  taxRate: 0,
  termsDays: 14,
  numberPrefix: "INV-{YYYY}-",
  numberPadding: 4,
  notes: "",
  paymentInfo: "",
  terms: "",
  layout: "mono",
};

export type ProfileResponse = { profile: Profile; nextNumber: number; nextInvoiceNumber: string };

export const profileUpdateSchema = z.object({
  profile: profileSchema,
  nextNumber: z.number().int().min(1).max(99_999_999).optional(),
});

export { formatInvoiceNumber, parseInvoiceNumber } from "./numbering";

// ── Invoices ──────────────────────────────────────────────────────────────

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceWriteSchema = z.object({
  data: invoiceSchema,
  status: invoiceStatusSchema.optional(),
  templateId: z.string().nullable().optional(),
});
export type InvoiceWrite = z.infer<typeof invoiceWriteSchema>;

export type InvoiceSummary = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  clientName: string;
  project: string;
  totalMinor: number;
  createdAt: number;
  updatedAt: number;
};

export type InvoiceRecord = InvoiceSummary & { data: z.infer<typeof invoiceSchema>; templateId: string | null };

export type ApiError = { error: string; message?: string; issues?: unknown };

// ── Clients ───────────────────────────────────────────────────────────────

export type ClientSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  invoiceCount: number;
  lastInvoiceDate: string | null;
};
