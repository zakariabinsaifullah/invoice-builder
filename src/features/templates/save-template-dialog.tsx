import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { Loader2, Pin } from "lucide-react";
import { defaultTemplateName, extractTemplate, TEMPLATE_PART_INFO, TEMPLATE_PARTS, type TemplatePart } from "@shared/template-core";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useEditor } from "@/features/editor/store";
import { HttpError } from "@/lib/api";
import { useCreateTemplate, useTemplates, useTemplatesFromInvoices, useUpdateTemplate } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Mode = { kind: "editor" } | { kind: "invoices"; ids: string[]; onDone?: () => void };

type State = { mode: Mode | null; show: (m: Mode) => void; hide: () => void };

export const useSaveTemplateDialog = create<State>((set) => ({
  mode: null,
  show: (mode) => set({ mode }),
  hide: () => set({ mode: null }),
}));

// Business details usually come from Settings, so they're off by default.
const DEFAULT_PARTS: TemplatePart[] = ["client", "items", "adjustments", "notes", "settings"];

const parseTags = (s: string) =>
  [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8).map((t) => t.slice(0, 24));

export function SaveTemplateDialog() {
  const { mode, hide } = useSaveTemplateDialog();
  const invoice = useEditor((s) => s.invoice);
  const sourceTemplateId = useEditor((s) => s.templateId);
  const templates = useTemplates().data;
  const sourceTemplate = templates?.find((t) => t.id === sourceTemplateId);

  const [parts, setParts] = useState<TemplatePart[]>(DEFAULT_PARTS);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [target, setTarget] = useState<"new" | "update">("new");

  const create = useCreateTemplate();
  const fromInvoices = useTemplatesFromInvoices();
  const update = useUpdateTemplate();
  const busy = create.isPending || fromInvoices.isPending || update.isPending;

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!mode) return;
    setParts(DEFAULT_PARTS);
    setName(mode.kind === "editor" ? defaultTemplateName(useEditor.getState().invoice) : "");
    setTags("");
    setPinned(false);
    setTarget("new");
  }, [mode]);

  // What each part would contain, for the single-invoice case.
  const summaries = useMemo<Record<TemplatePart, string>>(() => {
    const items = invoice.items.filter((i) => i.description.trim() || i.rate > 0);
    return {
      business: invoice.from.name || "—",
      client: [invoice.to.name, invoice.project].filter(Boolean).join(" · ") || "—",
      items: items.length ? `${items.length} item${items.length > 1 ? "s" : ""}` : "none",
      adjustments: [invoice.taxRate && `tax ${invoice.taxRate}%`, invoice.discount.value && "discount", invoice.shipping && "shipping"].filter(Boolean).join(", ") || "none",
      notes: [invoice.paymentInfo && "payment", invoice.notes && "notes", invoice.terms && "terms"].filter(Boolean).join(", ") || "empty",
      settings: `${invoice.currency} · ${invoice.termsDays === null ? "custom due" : `net ${invoice.termsDays}`} · ${invoice.style.layout}`,
    };
  }, [invoice]);

  if (!mode) return <Dialog open={false} onClose={hide} title="" children={null} />;

  const toggle = (p: TemplatePart) => setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const bulk = mode.kind === "invoices";

  const submit = async () => {
    if (!parts.length) return;
    try {
      if (mode.kind === "invoices") {
        const res = await fromInvoices.mutateAsync({ invoiceIds: mode.ids, parts, tags: parseTags(tags) });
        toast.success(`Saved ${res.templates.length} template${res.templates.length > 1 ? "s" : ""}`);
        mode.onDone?.();
      } else {
        const data = extractTemplate(useEditor.getState().invoice, parts);
        if (target === "update" && sourceTemplate) {
          await update.mutateAsync({ id: sourceTemplate.id, data, ...(name.trim() && { name: name.trim() }) });
          toast.success(`Updated “${name.trim() || sourceTemplate.name}”`);
        } else {
          const tpl = await create.mutateAsync({ name: name.trim() || defaultTemplateName(invoice), tags: parseTags(tags), pinned, data });
          useEditor.setState({ templateId: tpl.id });
          toast.success(`Saved template “${tpl.name}”`);
        }
      }
      hide();
    } catch (err) {
      toast.error(err instanceof HttpError && err.body.message ? err.body.message : "Couldn't save the template.");
    }
  };

  return (
    <Dialog
      open
      onClose={hide}
      kicker={bulk ? `template save --from ${mode.ids.length} invoices` : "template save"}
      title={bulk ? `Save ${mode.ids.length} invoice${mode.ids.length > 1 ? "s" : ""} as templates` : "Save as template"}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={hide}>
            cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !parts.length}>
            {busy && <Loader2 className="animate-spin" />}
            {bulk ? `save ${mode.ids.length} template${mode.ids.length > 1 ? "s" : ""}` : target === "update" ? "update template" : "save template"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!bulk && sourceTemplate && (
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            {(["new", "update"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTarget(t);
                  setName(t === "update" ? sourceTemplate.name : defaultTemplateName(invoice));
                  if (t === "update") setParts(sourceTemplate.preview.parts);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  target === t ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                )}
              >
                <div className="text-text">{t === "new" ? "new template" : "update existing"}</div>
                <div className="mt-0.5 truncate text-muted">{t === "new" ? "keep the original as is" : sourceTemplate.name}</div>
              </button>
            ))}
          </div>
        )}

        {bulk ? (
          <p className="text-sm text-muted">Each invoice becomes its own template, named after its client and first item. You can rename them later.</p>
        ) : (
          <Field label="name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="e.g. Monthly retainer — Acme" />
          </Field>
        )}

        <div>
          <div className="mb-2 font-mono text-[11px] text-muted">keep these parts</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {TEMPLATE_PARTS.map((p) => {
              const on = parts.includes(p);
              return (
                // div, not label: a label would forward the click to the checkbox button and toggle twice.
                <div
                  key={p}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                    on ? "border-accent/50 bg-accent-soft" : "border-border hover:border-border-strong",
                  )}
                  onClick={() => toggle(p)}
                >
                  <Checkbox checked={on} onChange={() => toggle(p)} label={TEMPLATE_PART_INFO[p].label} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-text">{TEMPLATE_PART_INFO[p].label}</span>
                    <span className="block truncate text-[11px] text-muted">{bulk ? TEMPLATE_PART_INFO[p].detail : summaries[p]}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Not kept → filled from your settings. Number and dates are always fresh.
          </p>
        </div>

        {target === "new" && (
          <div className="flex items-end gap-3">
            <Field label="tags" hint="comma separated" className="flex-1">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="retainer, monthly" />
            </Field>
            {!bulk && (
              <Button
                variant={pinned ? "secondary" : "ghost"}
                onClick={() => setPinned(!pinned)}
                className={cn("font-mono text-xs", pinned && "border-accent text-accent")}
                aria-pressed={pinned}
              >
                <Pin className={cn(pinned && "fill-current")} /> pin
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
