import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, FilePlus2, LayoutTemplate, Loader2, Search, Trash2, X } from "lucide-react";
import type { InvoiceStatus, InvoiceSummary } from "@shared/api";
import { formatMinor } from "@shared/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/toaster";
import { formatDate } from "@/lib/dates";
import { useSaveTemplateDialog } from "@/features/templates/save-template-dialog";
import { useBulkDeleteInvoices, useDeleteInvoice, useInvoices, useSetInvoiceStatus } from "@/lib/queries";
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

function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const showSaveTemplate = useSaveTemplateDialog((s) => s.show);
  const bulkDelete = useBulkDeleteInvoices();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4 md:pl-60">
      <div className="flex items-center gap-1 rounded-xl border border-border-strong bg-surface p-1.5 pl-4 shadow-2xl">
        <span className="mr-2 font-mono text-xs">
          <span className="text-accent">{ids.length}</span> selected
        </span>
        <Button variant="primary" size="sm" onClick={() => showSaveTemplate({ kind: "invoices", ids, onDone: onClear })}>
          <LayoutTemplate /> <span className="hidden sm:inline">save as</span> template{ids.length > 1 && "s"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("hover:text-danger", confirm && "text-danger")}
          disabled={bulkDelete.isPending}
          onClick={() =>
            confirm
              ? bulkDelete.mutate(ids, {
                  onSuccess: (r) => {
                    toast.success(`Deleted ${r.deleted.length} invoice${r.deleted.length > 1 ? "s" : ""}`);
                    onClear();
                  },
                  onError: () => toast.error("Couldn't delete."),
                })
              : setConfirm(true)
          }
        >
          {bulkDelete.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {confirm ? "sure?" : <span className="hidden sm:inline">delete</span>}
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClear} aria-label="Clear selection">
          <X />
        </Button>
      </div>
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drop selections that are no longer visible (deleted or filtered out).
  useEffect(() => {
    if (!data) return;
    setSelected((cur) => {
      const visible = new Set(data.map((i) => i.id));
      const next = new Set([...cur].filter((id) => visible.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [data]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = !!data?.length && selected.size === data.length;

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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, client or project…" className="pl-9" />
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
                <th className="w-px py-2.5 pl-4">
                  <Checkbox
                    label="Select all"
                    checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(data.map((i) => i.id)))}
                  />
                </th>
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
                  className={cn(
                    "group cursor-pointer border-b border-border last:border-0 hover:bg-surface-2",
                    selected.has(inv.id) && "bg-accent-soft hover:bg-accent-soft",
                  )}
                >
                  <td className="py-3 pl-4">
                    <Checkbox label={`Select ${inv.number}`} checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-mono text-[13px] font-medium hover:text-accent" onClick={(e) => e.stopPropagation()}>
                      {inv.number}
                    </Link>
                    <div className="font-mono text-[11px] text-muted">edited {timeAgo(inv.updatedAt)}</div>
                  </td>
                  <td className="max-w-48 px-4 py-3">
                    <div className="truncate">{inv.clientName || <span className="text-muted">—</span>}</div>
                    {inv.project && <div className="truncate font-mono text-[11px] text-muted">{inv.project}</div>}
                  </td>
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
      {selected.size > 0 && <div className="h-20" />}
      {selected.size > 0 && <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />}
    </div>
  );
}
