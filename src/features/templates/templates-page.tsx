import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Copy, LayoutTemplate, Loader2, Pencil, Pin, Search, Trash2, Zap } from "lucide-react";
import { applyTemplate, TEMPLATE_PART_INFO, type TemplateSummary } from "@shared/templates";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blankInvoice, invoiceFromProfile, newId } from "@/features/editor/store";
import { ScaledPreview } from "@/features/preview/scaled-preview";
import { useDeleteTemplate, useDuplicateTemplate, useProfile, useTemplates, useUpdateTemplate } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useStartFromTemplate } from "./use-start-from-template";

function TemplateCard({ t, onUse, using }: { t: TemplateSummary; onUse: () => void; using: boolean }) {
  const profile = useProfile().data;
  const update = useUpdateTemplate();
  const duplicate = useDuplicateTemplate();
  const del = useDeleteTemplate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(t.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const preview = useMemo(() => {
    const base = profile ? invoiceFromProfile(profile) : blankInvoice();
    return applyTemplate(base, t.preview, newId);
  }, [profile, t.preview]);

  const commitRename = () => {
    setRenaming(false);
    const next = name.trim();
    if (!next || next === t.name) return setName(t.name);
    update.mutate({ id: t.id, name: next }, { onError: () => (setName(t.name), toast.error("Couldn't rename.")) });
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
      <button
        onClick={onUse}
        className="relative h-44 overflow-hidden bg-surface-2 px-6 pt-5 text-left"
        aria-label={`New invoice from ${t.name}`}
      >
        <div className="pointer-events-none">
          <ScaledPreview invoice={preview} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-2 to-transparent" />
        <div className="absolute inset-0 grid place-items-center bg-bg/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-mono text-xs text-accent-fg">
            <Zap className="size-3.5" /> use template
          </span>
        </div>
        {t.pinned && (
          <span className="absolute left-3 top-3 grid size-6 place-items-center rounded-md bg-accent text-accent-fg">
            <Pin className="size-3 fill-current" />
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {renaming ? (
          <Input
            value={name}
            autoFocus
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") (setName(t.name), setRenaming(false));
            }}
            className="h-8"
          />
        ) : (
          <h3 className="truncate font-medium" title={t.name}>
            {t.name}
          </h3>
        )}

        <div className="flex flex-wrap gap-1">
          {t.preview.parts.map((p) => (
            <span key={p} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {TEMPLATE_PART_INFO[p].label}
            </span>
          ))}
          {t.tags.map((tag) => (
            <span key={tag} className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-mono text-[11px] text-muted">
            {t.useCount ? `used ${t.useCount}× · ${timeAgo(t.lastUsedAt!)}` : `created ${timeAgo(t.createdAt)}`}
          </span>
          <div className="flex gap-0.5">
            <IconBtn label={t.pinned ? "Unpin" : "Pin"} onClick={() => update.mutate({ id: t.id, pinned: !t.pinned })}>
              <Pin className={cn(t.pinned && "fill-current text-accent")} />
            </IconBtn>
            <IconBtn label="Rename" onClick={() => setRenaming(true)}>
              <Pencil />
            </IconBtn>
            <IconBtn
              label="Duplicate"
              onClick={() => duplicate.mutate(t.id, { onSuccess: (d) => toast.success(`Created “${d.name}”`) })}
            >
              {duplicate.isPending ? <Loader2 className="animate-spin" /> : <Copy />}
            </IconBtn>
            <IconBtn
              label={confirmDelete ? "Click again to delete" : "Delete"}
              className={cn("hover:text-danger", confirmDelete && "text-danger")}
              onClick={() =>
                confirmDelete
                  ? del.mutate(t.id, { onSuccess: () => toast.success(`Deleted “${t.name}”`) })
                  : setConfirmDelete(true)
              }
            >
              <Trash2 />
            </IconBtn>
          </div>
        </div>
        <Button variant="primary" size="sm" className="mt-1 w-full font-mono text-xs" onClick={onUse} disabled={using}>
          {using ? <Loader2 className="animate-spin" /> : <Zap />} new invoice from template
        </Button>
      </div>
    </article>
  );
}

function IconBtn({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Button variant="ghost" size="icon" className={cn("size-7 [&_svg]:size-3.5", className)} onClick={onClick} aria-label={label} title={label}>
      {children}
    </Button>
  );
}

export function TemplatesPage() {
  const { data, isPending, isError } = useTemplates();
  const { start, pendingId } = useStartFromTemplate();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => [...new Set((data ?? []).flatMap((t) => t.tags))].sort(), [data]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (t) =>
        (!tag || t.tags.includes(tag)) &&
        (!term || t.name.toLowerCase().includes(term) || t.preview.to?.name.toLowerCase().includes(term) || t.tags.some((x) => x.includes(term))),
    );
  }, [data, q, tag]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted">~/templates</div>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
            templates<span className="caret-blink text-accent">_</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Save once, invoice in seconds — each use gets a fresh number and today's date.</p>
        </div>
      </div>

      {data && data.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="pl-9" />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 font-mono text-xs">
              {[null, ...allTags].map((t) => (
                <button
                  key={t ?? "all"}
                  onClick={() => setTag(t)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 transition-colors",
                    tag === t ? "border-accent bg-accent-soft text-text" : "border-border text-muted hover:text-text",
                  )}
                >
                  {t ? `#${t}` : "all"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        {isPending ? (
          <div className="grid h-48 place-items-center text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center font-mono text-sm text-danger">couldn't load templates</div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong p-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-surface">
              <LayoutTemplate className="size-5 text-accent" />
            </div>
            <div className="mt-4 font-mono text-sm">no templates yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              In the editor, click <span className="font-mono text-text">template</span> to save the current invoice. Or select
              several on the <Link to="/invoices" className="text-accent hover:underline">invoices</Link> page and save them all at once.
            </p>
            <Link to="/" className="mt-5 inline-block font-mono text-sm text-accent hover:underline">
              → new_invoice
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center font-mono text-sm text-muted">no matches</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <TemplateCard key={t.id} t={t} onUse={() => start(t.id)} using={pendingId === t.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
