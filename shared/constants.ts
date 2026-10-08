// Kept separate from the zod schemas so the client bundle doesn't pull in zod for these.

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
