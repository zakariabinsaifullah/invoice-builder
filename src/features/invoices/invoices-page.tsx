import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, FilePlus2, Loader2, Search, Trash2 } from "lucide-react";
import type { InvoiceStatus, InvoiceSummary } from "@shared/api";
import { formatMinor } from "@shared/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/toaster";
import { formatDate } from "@/lib/dates";
import { useDeleteInvoice, useInvoices, useSetInvoiceStatus } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { displayStatus, StatusBadge } from "./status";

const FILTERS: { label: string; value?: InvoiceStatus }[] = [
  { label: "all" },
  { label: "draft", value: "draft" },
  { label: "sent", value: "sent" },
  { label: "paid", value: "paid" },
];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function RowActions({ inv }: { inv: InvoiceSummary }) {
  const setStatus = useSetInvoiceStatus();
  const del = useDeleteInvoice();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {inv.status !== "paid" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 font-mono text-[11px]"
          disabled={setStatus.isPending}
          onClick={() =>
            setStatus.mutate({ id: inv.id, status: "paid" }, { onSuccess: () => toast.success(`${inv.number} marked paid`) })
          }
          title="Mark as paid"
        >
          <Check className="size-3.5!" /> <span className="hidden lg:inline">paid</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2 font-mono text-[11px] hover:text-danger", confirm && "text-danger")}
        disabled={del.isPending}
        onClick={() =>
          confirm
            ? del.mutate(inv.id, {
                onSuccess: () => toast.success(`Deleted ${inv.number}`),
                onError: () => toast.error("Couldn't delete."),
              })
            : setConfirm(true)
        }
        title="Delete invoice"
      >
        {del.isPending ? <Loader2 className="size-3.5! animate-spin" /> : <Trash2 className="size-3.5!" />}
        {confirm && <span>sure?</span>}
      </Button>
    </div>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<InvoiceStatus | undefined>();
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const { data, isPending, isError, isFetching } = useInvoices({ status, q: query || undefined });
  const filtered = !!(status || query);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted">~/invoices</div>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
            invoices<span className="caret-blink text-accent">_</span>
          </h1>
        </div>
        <Button variant="primary" onClick={() => navigate("/")}>
          <FilePlus2 /> new invoice
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or client…" className="pl-9" />
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5 font-mono text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                status === f.value ? "bg-accent-soft text-text" : "text-muted hover:text-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isFetching && !isPending && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
        {isPending ? (
          <div className="grid h-48 place-items-center text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center font-mono text-sm text-danger">couldn't load invoices</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-mono text-sm">{filtered ? "no matches" : "no invoices yet"}</div>
            <p className="mt-2 text-sm text-muted">
              {filtered ? "Try a different search or filter." : "Create an invoice and hit save — it'll show up here."}
            </p>
            {!filtered && (
              <Link to="/" className="mt-4 inline-block font-mono text-sm text-accent hover:underline">
                → new_invoice
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] text-muted">
                <th className="px-4 py-2.5 font-normal">number</th>
                <th className="px-4 py-2.5 font-normal">client</th>
                <th className="hidden px-4 py-2.5 font-normal md:table-cell">issued</th>
                <th className="hidden px-4 py-2.5 font-normal md:table-cell">due</th>
                <th className="px-4 py-2.5 text-right font-normal">total</th>
                <th className="hidden px-4 py-2.5 font-normal sm:table-cell">status</th>
                <th className="w-px px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="group cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-mono text-[13px] font-medium hover:text-accent" onClick={(e) => e.stopPropagation()}>
                      {inv.number}
                    </Link>
                    <div className="font-mono text-[11px] text-muted">edited {timeAgo(inv.updatedAt)}</div>
                  </td>
                  <td className="max-w-48 truncate px-4 py-3">{inv.clientName || <span className="text-muted">—</span>}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted md:table-cell">{formatDate(inv.issueDate)}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted md:table-cell">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular">{formatMinor(inv.totalMinor, inv.currency)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <StatusBadge status={displayStatus(inv.status, inv.dueDate)} />
                  </td>
                  <td className="px-2 py-3">
                    <RowActions inv={inv} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
