import { Field, NumberInput, Textarea } from "@/components/ui/input";
import { computeTotals, formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { useEditor } from "./store";

export function SummaryCard() {
  const inv = useEditor((s) => s.invoice);
  const set = useEditor((s) => s.set);
  const t = computeTotals(inv);
  const money = (n: number) => formatMinor(n, inv.currency, t.digits);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card label="adjustments">
        <div className="grid grid-cols-2 gap-3">
          <Field label="tax_rate" hint="%">
            <NumberInput value={inv.taxRate} onValueChange={(v) => set("taxRate", Math.min(v, 100))} placeholder="0" />
          </Field>
          <Field label="shipping" hint={inv.currency}>
            <NumberInput value={inv.shipping} onValueChange={(v) => set("shipping", v)} placeholder="0.00" />
          </Field>
          <Field label="discount" className="col-span-2">
            <div className="flex gap-2">
              <div className="flex h-9 shrink-0 rounded-md border border-border bg-bg p-0.5 font-mono text-xs">
                {(["percent", "fixed"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set("discount", { ...inv.discount, type })}
                    className={cn(
                      "rounded px-3 transition-colors",
                      inv.discount.type === type ? "bg-surface-2 text-text shadow-sm" : "text-muted hover:text-text",
                    )}
                  >
                    {type === "percent" ? "%" : inv.currency}
                  </button>
                ))}
              </div>
              <NumberInput
                value={inv.discount.value}
                onValueChange={(value) => set("discount", { ...inv.discount, value })}
                placeholder="0"
                aria-label="Discount amount"
              />
            </div>
          </Field>
        </div>

        <dl className="mt-5 space-y-1.5 border-t border-border pt-4 font-mono text-sm tabular">
          <Line label="subtotal" value={money(t.subtotal)} />
          {t.discount > 0 && <Line label="discount" value={`−${money(t.discount)}`} />}
          {t.tax > 0 && <Line label="tax" value={money(t.tax)} />}
          {t.shipping > 0 && <Line label="shipping" value={money(t.shipping)} />}
          <div className="flex items-baseline justify-between pt-2">
            <dt className="text-muted">total</dt>
            <dd className="text-xl font-semibold text-accent">{money(t.total)}</dd>
          </div>
        </dl>
      </Card>

      <Card label="notes">
        <div className="flex flex-col gap-3">
          <Field label="payment_info">
            <Textarea rows={3} value={inv.paymentInfo} onChange={(e) => set("paymentInfo", e.target.value)} placeholder={"Bank: …\nIBAN / Account: …\nPayPal: you@example.com"} />
          </Field>
          <Field label="notes">
            <Textarea rows={2} value={inv.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Thanks for your business!" />
          </Field>
          <Field label="terms">
            <Textarea rows={2} value={inv.terms} onChange={(e) => set("terms", e.target.value)} placeholder="Late payments incur 2% monthly interest." />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
