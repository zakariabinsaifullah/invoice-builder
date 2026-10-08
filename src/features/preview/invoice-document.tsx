import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_ACCENT } from "@shared/constants";
import type { InvoiceData, Party } from "@shared/invoice";
import { computeTotals, formatMinor, lineAmountMinor, type Totals } from "@shared/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** A4 at 96dpi. The document is always laid out at this width and scaled for display. */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

/** Placeholder text shown on screen only — never printed. */
function Ph({ children }: { children: ReactNode }) {
  return <span className="text-stone-300 print:hidden">{children}</span>;
}

type DocProps = { invoice: InvoiceData; t: Totals; money: (minor: number) => string; rows: InvoiceData["items"]; accent: string };

function useDoc(invoice: InvoiceData): DocProps {
  const t = computeTotals(invoice);
  const items = invoice.items.filter((i) => i.description || i.rate || i.quantity !== 1);
  return {
    invoice,
    t,
    money: (minor) => formatMinor(minor, invoice.currency, t.digits),
    rows: items.length ? items : invoice.items.slice(0, 1),
    accent: invoice.style.accent ?? DEFAULT_ACCENT,
  };
}

const discountLabel = (inv: InvoiceData) => (inv.discount.type === "percent" ? `discount (${inv.discount.value}%)` : "discount");

const sections = (inv: InvoiceData) =>
  (
    [
      ["payment", inv.paymentInfo],
      ["notes", inv.notes],
      ["terms", inv.terms],
    ] as const
  ).filter(([, text]) => text.trim());

export function InvoiceDocument({ invoice, className }: { invoice: InvoiceData; className?: string }) {
  const doc = useDoc(invoice);
  const style: CSSProperties = { width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, ["--accent-doc" as string]: doc.accent };
  return invoice.style.layout === "minimal" ? (
    <MinimalDocument {...doc} className={className} style={style} />
  ) : (
    <MonoDocument {...doc} className={className} style={style} />
  );
}

// ── Mono: developer style ────────────────────────────────────────────────

function MonoParty({ label, party, fallback }: { label: string; party: Party; fallback: string }) {
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

function MonoDocument({ invoice, t, money, rows, className, style }: DocProps & { className?: string; style: CSSProperties }) {
  return (
    <article className={cn("flex flex-col bg-white px-14 py-14 font-mono text-[11.5px] leading-relaxed text-stone-700", className)} style={style}>
      <header className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          {invoice.style.logo ? <img src={invoice.style.logo} alt="" className="mb-3 max-h-14 max-w-[200px] object-contain" /> : null}
          <div className="text-[28px] font-bold leading-none tracking-tight text-stone-900">
            INVOICE<span className="text-(--accent-doc)">_</span>
          </div>
          <div className="mt-2 text-stone-500">#{invoice.number || <Ph>INV-0001</Ph>}</div>
        </div>
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right tabular">
          <dt className="text-stone-400">issued</dt>
          <dd className="text-stone-800">{formatDate(invoice.issueDate)}</dd>
          <dt className="text-stone-400">due</dt>
          <dd className="text-stone-800">{formatDate(invoice.dueDate)}</dd>
          <dt className="text-stone-400">amount_due</dt>
          <dd className="font-semibold text-(--accent-doc)">{money(t.total)}</dd>
        </dl>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-10 border-t border-stone-200 pt-6">
        <MonoParty label="from" party={invoice.from} fallback="Your business" />
        <MonoParty label="bill_to" party={invoice.to} fallback="Client name" />
      </div>

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

      <div className="mt-6 ml-auto w-72 space-y-1.5 tabular break-inside-avoid">
        <Row label="subtotal" value={money(t.subtotal)} />
        {t.discount > 0 && <Row label={discountLabel(invoice)} value={`−${money(t.discount)}`} />}
        {invoice.taxRate > 0 && <Row label={`tax (${invoice.taxRate}%)`} value={money(t.tax)} />}
        {t.shipping > 0 && <Row label="shipping" value={money(t.shipping)} />}
        <div className="flex items-baseline justify-between border-t border-stone-300 pt-2.5">
          <span className="text-stone-500">
            total <span className="text-stone-400">{invoice.currency}</span>
          </span>
          <span className="text-[17px] font-bold text-(--accent-doc)">{money(t.total)}</span>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-6">
        {sections(invoice).map(([label, text]) => (
          <div key={label} className="break-inside-avoid">
            <div className="text-[11px] text-stone-400">// {label}</div>
            <div className="mt-1 whitespace-pre-line text-stone-600">{text}</div>
          </div>
        ))}
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

// ── Minimal: clean sans-serif ────────────────────────────────────────────

function MinimalParty({ label, party, fallback }: { label: string; party: Party; fallback: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</div>
      <div className="mt-2 text-[14px] font-semibold text-stone-900">{party.name || <Ph>{fallback}</Ph>}</div>
      <div className="mt-1 space-y-0.5 text-stone-500">
        {party.address && <div className="whitespace-pre-line">{party.address}</div>}
        {party.email && <div>{party.email}</div>}
        {party.phone && <div>{party.phone}</div>}
        {party.taxId && <div>Tax ID: {party.taxId}</div>}
      </div>
    </div>
  );
}

function MinimalDocument({ invoice, t, money, rows, className, style }: DocProps & { className?: string; style: CSSProperties }) {
  const label = "text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400";
  return (
    <article className={cn("flex flex-col bg-white font-sans text-[12px] leading-relaxed text-stone-700", className)} style={style}>
      <div className="h-1.5 bg-(--accent-doc)" />
      <div className="flex flex-1 flex-col px-14 pb-14 pt-12">
        <header className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            {invoice.style.logo ? (
              <img src={invoice.style.logo} alt="" className="mb-3 max-h-14 max-w-[200px] object-contain" />
            ) : (
              <div className="text-[18px] font-semibold text-stone-900">{invoice.from.name || <Ph>Your business</Ph>}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[30px] font-semibold leading-none tracking-tight text-(--accent-doc)">Invoice</div>
            <div className="mt-2 text-stone-500 tabular">{invoice.number || <Ph>INV-0001</Ph>}</div>
          </div>
        </header>

        <div className="mt-10 grid grid-cols-3 gap-3 tabular">
          {[
            ["Issued", formatDate(invoice.issueDate)],
            ["Due", formatDate(invoice.dueDate)],
            ["Amount due", money(t.total)],
          ].map(([k, v], i) => (
            <div key={k} className="rounded-lg bg-stone-50 px-4 py-3">
              <div className={label}>{k}</div>
              <div className={cn("mt-1 text-[14px] font-semibold", i === 2 ? "text-(--accent-doc)" : "text-stone-900")}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10">
          <MinimalParty label="From" party={invoice.from} fallback="Your business" />
          <MinimalParty label="Bill to" party={invoice.to} fallback="Client name" />
        </div>

        <table className="mt-10 w-full table-fixed tabular">
          <colgroup>
            <col />
            <col className="w-16" />
            <col className="w-28" />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="bg-stone-50 text-left">
              <th className={cn(label, "rounded-l-md px-3 py-2.5")}>Description</th>
              <th className={cn(label, "py-2.5 text-right")}>Qty</th>
              <th className={cn(label, "py-2.5 text-right")}>Rate</th>
              <th className={cn(label, "rounded-r-md px-3 py-2.5 text-right")}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="break-inside-avoid border-b border-stone-100 align-top">
                <td className="break-words px-3 py-3 text-stone-800">{item.description || <Ph>Item description</Ph>}</td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right">{money(Math.round(item.rate * 10 ** t.digits))}</td>
                <td className="px-3 py-3 text-right font-medium text-stone-900">{money(lineAmountMinor(item, t.digits))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-72 space-y-1.5 px-3 tabular break-inside-avoid">
          <Row label="Subtotal" value={money(t.subtotal)} />
          {t.discount > 0 && <Row label={discountLabel(invoice).replace("discount", "Discount")} value={`−${money(t.discount)}`} />}
          {invoice.taxRate > 0 && <Row label={`Tax (${invoice.taxRate}%)`} value={money(t.tax)} />}
          {t.shipping > 0 && <Row label="Shipping" value={money(t.shipping)} />}
          <div className="flex items-baseline justify-between border-t-2 border-(--accent-doc) pt-2.5">
            <span className="font-semibold text-stone-900">Total {invoice.currency}</span>
            <span className="text-[18px] font-semibold text-(--accent-doc)">{money(t.total)}</span>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-6">
          {sections(invoice).map(([key, text]) => (
            <div key={key} className="break-inside-avoid">
              <div className={label}>{key === "payment" ? "Payment details" : key[0].toUpperCase() + key.slice(1)}</div>
              <div className="mt-1.5 whitespace-pre-line text-stone-600">{text}</div>
            </div>
          ))}
        </div>

        <footer className="mt-auto pt-10 text-center text-[10px] text-stone-400">Thank you for your business</footer>
      </div>
    </article>
  );
}
