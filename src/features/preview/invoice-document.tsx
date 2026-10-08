import type { ReactNode } from "react";
import type { InvoiceData, Party } from "@shared/invoice";
import { computeTotals, formatMinor, lineAmountMinor } from "@shared/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** A4 at 96dpi. The document is always laid out at this width and scaled for display. */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

/** Placeholder text shown on screen only — never printed. */
function Ph({ children }: { children: ReactNode }) {
  return <span className="text-stone-300 print:hidden">{children}</span>;
}

function PartyBlock({ label, party, fallback }: { label: string; party: Party; fallback: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-stone-400">// {label}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-stone-900">{party.name || <Ph>{fallback}</Ph>}</div>
      <div className="mt-1 space-y-0.5 text-stone-500">
        {party.address && <div className="whitespace-pre-line">{party.address}</div>}
        {party.email && <div>{party.email}</div>}
        {party.phone && <div>{party.phone}</div>}
        {party.taxId && (
          <div>
            <span className="text-stone-400">tax_id:</span> {party.taxId}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="break-inside-avoid">
      <div className="text-[11px] text-stone-400">// {label}</div>
      <div className="mt-1 whitespace-pre-line text-stone-600">{text}</div>
    </div>
  );
}

export function InvoiceDocument({ invoice, className }: { invoice: InvoiceData; className?: string }) {
  const t = computeTotals(invoice);
  const money = (minor: number) => formatMinor(minor, invoice.currency, t.digits);
  const items = invoice.items.filter((i) => i.description || i.rate || i.quantity !== 1);
  const rows = items.length ? items : invoice.items.slice(0, 1);

  return (
    <article
      className={cn("flex flex-col bg-white px-14 py-14 font-mono text-[11.5px] leading-relaxed text-stone-700", className)}
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}
    >
      {/* header */}
      <header className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          {invoice.style.logo ? (
            <img src={invoice.style.logo} alt="" className="mb-3 max-h-14 max-w-[200px] object-contain" />
          ) : null}
          <div className="text-[28px] font-bold leading-none tracking-tight text-stone-900">
            INVOICE<span className="text-emerald-600">_</span>
          </div>
          <div className="mt-2 text-stone-500">#{invoice.number || <Ph>INV-0001</Ph>}</div>
        </div>
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right tabular">
          <dt className="text-stone-400">issued</dt>
          <dd className="text-stone-800">{formatDate(invoice.issueDate)}</dd>
          <dt className="text-stone-400">due</dt>
          <dd className="text-stone-800">{formatDate(invoice.dueDate)}</dd>
          <dt className="text-stone-400">amount_due</dt>
          <dd className="font-semibold text-emerald-600">{money(t.total)}</dd>
        </dl>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-10 border-t border-stone-200 pt-6">
        <PartyBlock label="from" party={invoice.from} fallback="Your business" />
        <PartyBlock label="bill_to" party={invoice.to} fallback="Client name" />
      </div>

      {/* items */}
      <table className="mt-10 w-full table-fixed tabular">
        <colgroup>
          <col className="w-8" />
          <col />
          <col className="w-16" />
          <col className="w-28" />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr className="border-b border-stone-300 text-left text-[11px] text-stone-400">
            <th className="pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">description</th>
            <th className="pb-2 text-right font-normal">qty</th>
            <th className="pb-2 text-right font-normal">rate</th>
            <th className="pb-2 text-right font-normal">amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, n) => (
            <tr key={item.id} className="break-inside-avoid border-b border-stone-100 align-top">
              <td className="py-2.5 text-stone-300">{String(n + 1).padStart(2, "0")}</td>
              <td className="break-words py-2.5 pr-4 text-stone-800">{item.description || <Ph>Item description</Ph>}</td>
              <td className="py-2.5 text-right">{item.quantity}</td>
              <td className="py-2.5 text-right">{money(Math.round(item.rate * 10 ** t.digits))}</td>
              <td className="py-2.5 text-right text-stone-900">{money(lineAmountMinor(item, t.digits))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="mt-6 ml-auto w-72 space-y-1.5 tabular break-inside-avoid">
        <Row label="subtotal" value={money(t.subtotal)} />
        {t.discount > 0 && (
          <Row
            label={invoice.discount.type === "percent" ? `discount (${invoice.discount.value}%)` : "discount"}
            value={`−${money(t.discount)}`}
          />
        )}
        {invoice.taxRate > 0 && <Row label={`tax (${invoice.taxRate}%)`} value={money(t.tax)} />}
        {t.shipping > 0 && <Row label="shipping" value={money(t.shipping)} />}
        <div className="flex items-baseline justify-between border-t border-stone-300 pt-2.5">
          <span className="text-stone-500">total <span className="text-stone-400">{invoice.currency}</span></span>
          <span className="text-[17px] font-bold text-emerald-600">{money(t.total)}</span>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-6">
        <Section label="payment" text={invoice.paymentInfo} />
        <Section label="notes" text={invoice.notes} />
        <Section label="terms" text={invoice.terms} />
      </div>

      <footer className="mt-auto pt-10 text-center text-[10px] text-stone-300">
        {invoice.from.name ? `${invoice.from.name} · ` : ""}#{invoice.number} · thank you
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}
