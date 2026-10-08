import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, Lock, PencilLine, Printer, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { DetailsCard } from "@/features/editor/details-card";
import { ItemsCard } from "@/features/editor/items-card";
import { PartiesCard } from "@/features/editor/parties-card";
import { useEditor } from "@/features/editor/store";
import { SummaryCard } from "@/features/editor/summary-card";
import { InvoiceDocument } from "@/features/preview/invoice-document";
import { ScaledPreview } from "@/features/preview/scaled-preview";
import { cn } from "@/lib/utils";

export function EditorPage() {
  const invoice = useEditor((s) => s.invoice);
  const reset = useEditor((s) => s.reset);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState("");

  const promptSignIn = () => setToast("Sign in to save invoices and templates — coming soon.");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        promptSignIn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = `${invoice.number || "untitled"}${invoice.to.name ? ` · ${invoice.to.name}` : ""}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-muted">~/new_invoice</div>
          <h1 className="truncate font-mono text-base font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (confirmReset ? (reset(), setConfirmReset(false)) : setConfirmReset(true))}
            className={cn(confirmReset && "text-danger hover:text-danger")}
            title="Start a new blank invoice"
          >
            <RotateCcw /> <span className="hidden lg:inline">{confirmReset ? "sure? click again" : "new"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={promptSignIn} title="Sign in to save">
            <Save /> <span className="hidden lg:inline">save</span>
            <Lock className="size-3! opacity-60" />
          </Button>
          <Button size="sm" onClick={() => window.print()} title="Print (⌘P)">
            <Printer /> <span className="hidden sm:inline">print</span>
          </Button>
          <Button variant="primary" size="sm" disabled title="PDF download arrives in the next update">
            <Download /> <span className="hidden sm:inline">pdf</span>
          </Button>
        </div>
      </header>

      {/* mobile / tablet view switch */}
      <div className="sticky top-[61px] z-10 flex justify-center border-b border-border bg-bg/90 py-2 backdrop-blur xl:hidden">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 font-mono text-xs">
          {(
            [
              ["edit", PencilLine],
              ["preview", Eye],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 transition-colors",
                tab === key ? "bg-accent-soft text-text" : "text-muted hover:text-text",
              )}
            >
              <Icon className="size-3.5" /> {key}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn("flex flex-col gap-4 p-4 md:p-6", tab !== "edit" && "hidden xl:flex")}>
          <DetailsCard />
          <PartiesCard />
          <ItemsCard />
          <SummaryCard />
          <p className="pb-4 text-center font-mono text-[11px] text-muted">
            guest draft lives in this tab only · <Kbd>⌘</Kbd>
            <Kbd>P</Kbd> print
          </p>
        </div>

        <aside className={cn("border-border bg-surface-2/60 xl:border-l", tab !== "preview" && "hidden xl:block")}>
          <div className="p-4 md:p-6 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-61px)] xl:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-muted">
              <span>
                <span className="text-accent">●</span> live_preview
              </span>
              <span>A4 · {invoice.currency}</span>
            </div>
            <div className="mx-auto max-w-[680px]">
              <ScaledPreview invoice={invoice} />
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border-strong bg-surface px-4 py-2.5 font-mono text-xs shadow-lg"
        >
          <span className="text-accent">→</span> {toast}
        </div>
      )}

      {createPortal(
        <div id="print-root">
          <InvoiceDocument invoice={invoice} />
        </div>,
        document.body,
      )}
    </div>
  );
}
