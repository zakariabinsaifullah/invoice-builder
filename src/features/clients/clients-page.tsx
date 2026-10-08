import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FilePlus2, Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import type { ClientSummary } from "@shared/api";
import type { Party } from "@shared/invoice";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { blankInvoice, emptyParty, invoiceFromProfile, useEditor } from "@/features/editor/store";
import { formatDate } from "@/lib/dates";
import { useClients, useDeleteClient, useProfile, useSaveClient } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ClientDialog({ client, onClose }: { client: (Party & { id?: string }) | null; onClose: () => void }) {
  const save = useSaveClient();
  const [form, setForm] = useState<Party>(emptyParty());
  useEffect(() => {
    if (client) setForm({ ...emptyParty(), ...client });
  }, [client]);
  const set = (k: keyof Party) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = () =>
    save.mutate(
      { ...form, ...(client?.id && { id: client.id }) },
      {
        onSuccess: () => {
          toast.success(client?.id ? "Client updated" : "Client added");
          onClose();
        },
        onError: () => toast.error("Couldn't save the client."),
      },
    );

  return (
    <Dialog
      open={!!client}
      onClose={onClose}
      kicker={client?.id ? "client edit" : "client add"}
      title={client?.id ? "Edit client" : "New client"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} save client
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="name" className="col-span-2">
          <Input value={form.name} onChange={set("name")} autoFocus placeholder="Client or company" />
        </Field>
        <Field label="email">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="phone">
          <Input type="tel" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="address" className="col-span-2">
          <Textarea rows={2} value={form.address} onChange={set("address")} />
        </Field>
        <Field label="tax_id" hint="optional" className="col-span-2">
          <Input value={form.taxId} onChange={set("taxId")} />
        </Field>
      </div>
    </Dialog>
  );
}

function DeleteButton({ c }: { c: ClientSummary }) {
  const del = useDeleteClient();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 px-2 hover:text-danger", confirm && "text-danger")}
      onClick={() => (confirm ? del.mutate(c.id, { onSuccess: () => toast.success(`Removed ${c.name}`) }) : setConfirm(true))}
      title={confirm ? "Click again — invoices are kept" : "Remove client"}
      aria-label="Remove client"
    >
      <Trash2 className="size-3.5!" />
      {confirm && <span className="font-mono text-[11px]">sure?</span>}
    </Button>
  );
}

export function ClientsPage() {
  const { data, isPending, isError } = useClients();
  const profile = useProfile().data;
  const navigate = useNavigate();
  const [editing, setEditing] = useState<(Party & { id?: string }) | null>(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term));
  }, [data, q]);

  const invoiceFor = (c: ClientSummary) => {
    const base = profile ? invoiceFromProfile(profile) : blankInvoice();
    useEditor.getState().startFromTemplate({ ...base, to: { name: c.name, email: c.email, phone: c.phone, address: c.address, taxId: c.taxId } }, null);
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted">~/clients</div>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
            clients<span className="caret-blink text-accent">_</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Clients are saved automatically the first time you bill them.</p>
        </div>
        <Button variant="primary" onClick={() => setEditing(emptyParty())}>
          <Plus /> add client
        </Button>
      </div>

      {data && data.length > 0 && (
        <div className="relative mt-6 w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-9" />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
        {isPending ? (
          <div className="grid h-48 place-items-center text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center font-mono text-sm text-danger">couldn't load clients</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-bg">
              <Users className="size-5 text-accent" />
            </div>
            <div className="mt-4 font-mono text-sm">no clients yet</div>
            <p className="mt-2 text-sm text-muted">Save an invoice with a bill-to name and the client appears here.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center font-mono text-sm text-muted">no matches</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] text-muted">
                <th className="px-4 py-2.5 font-normal">name</th>
                <th className="hidden px-4 py-2.5 font-normal md:table-cell">email</th>
                <th className="px-4 py-2.5 text-right font-normal">invoices</th>
                <th className="hidden px-4 py-2.5 font-normal sm:table-cell">last invoice</th>
                <th className="w-px px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="max-w-56 px-4 py-3">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.address && <div className="truncate text-xs text-muted">{c.address.split("\n")[0]}</div>}
                  </td>
                  <td className="hidden max-w-56 truncate px-4 py-3 font-mono text-xs text-muted md:table-cell">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular">{c.invoiceCount}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted sm:table-cell">
                    {c.lastInvoiceDate ? formatDate(c.lastInvoiceDate) : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[11px]" onClick={() => invoiceFor(c)} title="New invoice for this client">
                        <FilePlus2 className="size-3.5!" /> <span className="hidden lg:inline">invoice</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(c)} aria-label="Edit client" title="Edit client">
                        <Pencil className="size-3.5!" />
                      </Button>
                      <DeleteButton c={c} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ClientDialog client={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
