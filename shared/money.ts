import type { InvoiceData, LineItem } from "./invoice";

/** Number of minor units for a currency (USD → 2, JPY → 0). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

const toMinor = (major: number, digits: number) => Math.round(major * 10 ** digits);

export function lineAmountMinor(item: Pick<LineItem, "quantity" | "rate">, digits: number): number {
  return Math.round(item.quantity * toMinor(item.rate, digits));
}

export type Totals = {
  digits: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
};

/** All amounts in integer minor units. Discount is applied before tax. */
export function computeTotals(inv: Pick<InvoiceData, "items" | "currency" | "taxRate" | "discount" | "shipping">): Totals {
  const digits = currencyDigits(inv.currency);
  const subtotal = inv.items.reduce((s, i) => s + lineAmountMinor(i, digits), 0);
  const rawDiscount =
    inv.discount.type === "percent"
      ? Math.round((subtotal * Math.min(inv.discount.value, 100)) / 100)
      : toMinor(inv.discount.value, digits);
  const discount = Math.min(rawDiscount, subtotal);
  const tax = Math.round(((subtotal - discount) * inv.taxRate) / 100);
  const shipping = toMinor(inv.shipping, digits);
  return { digits, subtotal, discount, tax, shipping, total: subtotal - discount + tax + shipping };
}

export function formatMinor(minor: number, currency: string, digits = currencyDigits(currency)): string {
  const major = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(digits)}`;
  }
}

export function formatMajor(major: number, currency: string): string {
  return formatMinor(toMinor(major, currencyDigits(currency)), currency);
}
