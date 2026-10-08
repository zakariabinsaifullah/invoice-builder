import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { InvoiceData } from "@shared/invoice";
import { InvoicePdf, registerPdfFonts } from "./invoice-pdf";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function pdfFileName(inv: InvoiceData): string {
  return [slug(inv.number) || "invoice", slug(inv.to.name)].filter(Boolean).join("_") + ".pdf";
}

export async function renderInvoicePdf(invoice: InvoiceData): Promise<Blob> {
  registerPdfFonts();
  // createElement keeps this file .ts; the type cast satisfies pdf()'s Document-only signature.
  return pdf(createElement(InvoicePdf, { invoice }) as Parameters<typeof pdf>[0]).toBlob();
}

export async function downloadInvoicePdf(invoice: InvoiceData): Promise<void> {
  const blob = await renderInvoicePdf(invoice);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfFileName(invoice);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
