import { CURRENCIES, PAYMENT_TERMS } from "@shared/constants";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "./card";
import { useEditor } from "./store";

export function DetailsCard() {
  const inv = useEditor((s) => s.invoice);
  const { set, setIssueDate, setTerms, setDueDate } = useEditor.getState();
  const termsValue = inv.termsDays === null ? "custom" : String(inv.termsDays);
  const knownTerm = PAYMENT_TERMS.some((t) => t.days === inv.termsDays);

  return (
    <Card label="invoice">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Field label="number">
          <Input className="font-mono" value={inv.number} onChange={(e) => set("number", e.target.value)} placeholder="INV-0001" />
        </Field>
        <Field label="currency">
          <Select className="font-mono" value={inv.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="issue_date">
          <Input type="date" className="font-mono" value={inv.issueDate} onChange={(e) => e.target.value && setIssueDate(e.target.value)} />
        </Field>
        <Field label="payment_terms">
          <Select value={termsValue} onChange={(e) => setTerms(e.target.value === "custom" ? null : Number(e.target.value))}>
            {PAYMENT_TERMS.map((t) => (
              <option key={t.label} value={t.days === null ? "custom" : t.days}>
                {t.label}
              </option>
            ))}
            {!knownTerm && inv.termsDays !== null && <option value={inv.termsDays}>Net {inv.termsDays}</option>}
          </Select>
        </Field>
        <Field label="project" hint="optional" className="col-span-2 lg:col-span-1 lg:order-last">
          <Input value={inv.project ?? ""} onChange={(e) => set("project", e.target.value)} placeholder="e.g. Website redesign" maxLength={200} />
        </Field>
        <Field label="due_date">
          <Input
            type="date"
            className="font-mono"
            value={inv.dueDate}
            min={inv.issueDate}
            onChange={(e) => e.target.value && setDueDate(e.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}
