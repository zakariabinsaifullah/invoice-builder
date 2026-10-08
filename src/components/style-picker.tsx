import { Check } from "lucide-react";
import { ACCENTS, DEFAULT_ACCENT, LAYOUTS } from "@shared/constants";
import type { InvoiceData } from "@shared/invoice";
import { cn } from "@/lib/utils";

type Layout = InvoiceData["style"]["layout"];

/** Layout + accent picker, shared by the editor and Settings. */
export function StylePicker({
  layout,
  accent,
  onChange,
}: {
  layout: Layout;
  accent: string | undefined;
  onChange: (v: { layout: Layout; accent: string }) => void;
}) {
  const current = accent ?? DEFAULT_ACCENT;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Invoice layout">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={layout === l.id}
            onClick={() => onChange({ layout: l.id, accent: current })}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
              layout === l.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
            )}
          >
            {/* tiny page thumbnail */}
            <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-black/10">
              {l.id === "minimal" ? (
                <>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: current }} />
                  <span className="absolute right-1 top-2 h-1 w-3 rounded-full" style={{ background: current }} />
                  <span className="absolute inset-x-1 top-5 h-1.5 rounded-sm bg-stone-100" />
                  <span className="absolute inset-x-1 top-8 h-px bg-stone-200" />
                  <span className="absolute inset-x-1 top-10 h-px bg-stone-200" />
                </>
              ) : (
                <>
                  <span className="absolute left-1 top-1.5 h-1 w-4 bg-stone-800" />
                  <span className="absolute left-[21px] top-1.5 h-1 w-1" style={{ background: current }} />
                  <span className="absolute inset-x-1 top-5 h-px bg-stone-300" />
                  {[7, 9, 11].map((y) => (
                    <span key={y} className="absolute left-1 h-px w-0.5 bg-stone-300" style={{ top: y * 4 }} />
                  ))}
                  <span className="absolute bottom-1.5 right-1 h-1 w-3" style={{ background: current }} />
                </>
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-xs text-text">{l.label}</span>
              <span className="block truncate text-[11px] text-muted">{l.detail}</span>
            </span>
          </button>
        ))}
      </div>
      <div>
        <div className="mb-2 font-mono text-[11px] text-muted">accent</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a.hex}
              role="radio"
              aria-checked={current === a.hex}
              aria-label={a.name}
              title={a.name}
              onClick={() => onChange({ layout, accent: a.hex })}
              className={cn(
                "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow",
                current === a.hex ? "ring-2 ring-text" : "hover:ring-2 hover:ring-border-strong",
              )}
              style={{ background: a.hex }}
            >
              {current === a.hex && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
