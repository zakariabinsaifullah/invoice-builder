import { Download, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

const SAMPLE = [
  { d: "API integration — Stripe webhooks", q: 12, r: 95 },
  { d: "Frontend dashboard (React)", q: 20, r: 85 },
  { d: "Code review & deployment", q: 4, r: 110 },
];

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function EditorPage() {
  const subtotal = SAMPLE.reduce((s, i) => s + i.q * i.r, 0);
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted">~/new_invoice</div>
          <h1 className="truncate font-mono text-lg font-semibold tracking-tight">untitled.invoice</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled title="Sign in to save">
            <Save /> <span className="hidden sm:inline">save</span>
          </Button>
          <Button size="sm" disabled>
            <Printer /> <span className="hidden sm:inline">print</span>
          </Button>
          <Button variant="primary" size="sm" disabled>
            <Download /> <span className="hidden sm:inline">download_pdf</span>
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-6 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="font-mono text-xs text-muted">// editor</div>
          <p className="mt-2 text-sm text-muted">
            The invoice form lands in milestone 2. Shortcuts: <Kbd>⌘</Kbd> <Kbd>S</Kbd> save · <Kbd>⌘</Kbd> <Kbd>P</Kbd> pdf ·{" "}
            <Kbd>⌘</Kbd> <Kbd>K</Kbd> commands
          </p>
        </section>

        <section className="rounded-xl bg-surface-2 p-4 md:p-8">
          <div className="mx-auto aspect-[1/1.414] w-full max-w-[560px] bg-white p-8 font-mono text-[11px] text-stone-800 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold tracking-tight text-stone-900">INVOICE</div>
                <div className="text-stone-500">#INV-2026-0001</div>
              </div>
              <div className="text-right text-stone-500">
                <div>
                  <span className="text-emerald-600">$</span> issued 2026-10-08
                </div>
                <div>due 2026-10-22</div>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <div className="text-stone-400">// from</div>
                <div className="mt-1 font-semibold text-stone-900">Your Studio</div>
                <div className="text-stone-500">hello@yourstudio.dev</div>
              </div>
              <div>
                <div className="text-stone-400">// bill_to</div>
                <div className="mt-1 font-semibold text-stone-900">Acme Inc.</div>
                <div className="text-stone-500">billing@acme.com</div>
              </div>
            </div>
            <table className="mt-8 w-full tabular">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-400">
                  <th className="w-6 pb-2 font-normal">#</th>
                  <th className="pb-2 font-normal">description</th>
                  <th className="pb-2 text-right font-normal">qty</th>
                  <th className="pb-2 text-right font-normal">rate</th>
                  <th className="pb-2 text-right font-normal">amount</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE.map((i, n) => (
                  <tr key={i.d} className="border-b border-stone-100">
                    <td className="py-2 text-stone-300">{String(n + 1).padStart(2, "0")}</td>
                    <td className="py-2">{i.d}</td>
                    <td className="py-2 text-right">{i.q}</td>
                    <td className="py-2 text-right">{fmt(i.r)}</td>
                    <td className="py-2 text-right">{fmt(i.q * i.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 ml-auto w-1/2 space-y-1 tabular">
              <div className="flex justify-between text-stone-500">
                <span>subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-bold">
                <span>total</span>
                <span className="text-emerald-600">{fmt(subtotal)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
