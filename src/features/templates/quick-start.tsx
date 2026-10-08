import { Link } from "react-router";
import { LayoutTemplate, Loader2, Pin, Zap } from "lucide-react";
import { useEditor } from "@/features/editor/store";
import { useTemplates } from "@/lib/queries";
import { useStartFromTemplate } from "./use-start-from-template";

/** Shown on an untouched new invoice: one click to start from a pinned/recent template. */
export function QuickStart() {
  const fresh = useEditor((s) => s.fresh);
  const savedId = useEditor((s) => s.savedId);
  const templateId = useEditor((s) => s.templateId);
  const { data } = useTemplates();
  const { start, pendingId } = useStartFromTemplate();

  if (savedId || !data?.length) return null;

  if (!fresh) {
    const from = templateId && data.find((t) => t.id === templateId);
    return from ? (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-muted">
        <LayoutTemplate className="size-3.5 text-accent" /> from template <span className="truncate text-text">{from.name}</span>
      </div>
    ) : null;
  }

  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs text-muted">
          <span className="text-accent">//</span> quick_start <span className="opacity-60">— from a template</span>
        </h2>
        <Link to="/templates" className="font-mono text-[11px] text-muted hover:text-accent">
          all templates →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.slice(0, 6).map((t) => (
          <button
            key={t.id}
            onClick={() => start(t.id)}
            disabled={!!pendingId}
            className="flex max-w-64 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {pendingId === t.id ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : t.pinned ? (
              <Pin className="size-3.5 shrink-0 fill-current text-accent" />
            ) : (
              <Zap className="size-3.5 shrink-0 text-accent" />
            )}
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
