// Kept separate from the zod schemas so the client bundle doesn't pull in zod for these.

export const PAYMENT_TERMS: { label: string; days: number | null }[] = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 7", days: 7 },
  { label: "Net 14", days: 14 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 60", days: 60 },
  { label: "Custom date", days: null },
];

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "INR", "BDT", "PKR", "AED", "SGD", "JPY", "CNY", "CHF", "SEK", "NZD", "BRL", "MXN", "ZAR",
] as const;

/** Print-safe accent colours for invoices. */
export const ACCENTS = [
  { name: "emerald", hex: "#059669" },
  { name: "indigo", hex: "#4f46e5" },
  { name: "sky", hex: "#0284c7" },
  { name: "violet", hex: "#7c3aed" },
  { name: "rose", hex: "#e11d48" },
  { name: "amber", hex: "#d97706" },
  { name: "slate", hex: "#334155" },
] as const;

export const DEFAULT_ACCENT = "#059669";

export const LAYOUTS = [
  { id: "mono", label: "mono", detail: "Developer style, monospace" },
  { id: "minimal", label: "minimal", detail: "Clean sans-serif" },
] as const;
