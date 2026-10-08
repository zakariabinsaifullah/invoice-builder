import { z } from "zod";

export const partySchema = z.object({
  name: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(60).default(""),
  address: z.string().max(500).default(""),
  taxId: z.string().max(100).default(""),
});

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().max(500).default(""),
  quantity: z.number().min(0).max(1e9).default(1),
  /** Unit price in major currency units (e.g. dollars). Totals are computed in minor units. */
  rate: z.number().min(0).max(1e12).default(0),
});

export const discountSchema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(0).max(1e12),
});

export const invoiceStyleSchema = z.object({
  layout: z.enum(["mono", "minimal"]).default("mono"),
  logo: z.string().nullable().default(null),
});

export const invoiceSchema = z.object({
  number: z.string().max(60),
  issueDate: z.string(), // YYYY-MM-DD
  /** Days until due. null = custom due date. */
  termsDays: z.number().int().min(0).max(365).nullable(),
  dueDate: z.string(),
  currency: z.string().length(3),
  from: partySchema,
  to: partySchema,
  items: z.array(lineItemSchema).max(200),
  taxRate: z.number().min(0).max(100),
  discount: discountSchema,
  shipping: z.number().min(0).max(1e12),
  notes: z.string().max(2000),
  paymentInfo: z.string().max(2000),
  terms: z.string().max(2000),
  style: invoiceStyleSchema,
});

export type Party = z.infer<typeof partySchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type Discount = z.infer<typeof discountSchema>;
export type InvoiceData = z.infer<typeof invoiceSchema>;

export const PAYMENT_TERMS: { label: string; days: number | null }[] = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 7", days: 7 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 60", days: 60 },
  { label: "Custom date", days: null },
];

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "INR", "BDT", "PKR", "AED", "SGD", "JPY", "CNY", "CHF", "SEK", "NZD", "BRL", "MXN", "ZAR",
] as const;
