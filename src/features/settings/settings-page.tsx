import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "@shared/constants";
import { formatInvoiceNumber, type Profile } from "@shared/api";
import { LogoInput } from "@/components/logo-input";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/features/editor/card";
import { useProfile, useSaveProfile } from "@/lib/queries";

function Section({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="font-mono text-sm">
          <span className="text-accent">//</span> {label}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { data, isPending } = useProfile();
  const saveMutation = useSaveProfile();
  const [form, setForm] = useState<Profile | null>(null);
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    if (data && !form) {
      setForm(data.profile);
      setNextNumber(data.nextNumber);
    }
  }, [data, form]);

  if (isPending || !form || !data)
    return (
      <div className="grid h-64 place-items-center text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );

  const dirty = JSON.stringify(form) !== JSON.stringify(data.profile) || nextNumber !== data.nextNumber;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm({ ...form, [k]: v });
  const setBiz = (k: keyof Profile["business"], v: string) => setForm({ ...form, business: { ...form.business, [k]: v } });

  const save = () =>
    saveMutation.mutate(
      { profile: form, ...(nextNumber !== data.nextNumber && { nextNumber }) },
      {
        onSuccess: (res) => {
          setForm(res.profile);
          setNextNumber(res.nextNumber);
          toast.success("Settings saved — new invoices will use them.");
        },
        onError: () => toast.error("Couldn't save settings."),
      },
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted">~/settings</div>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
            settings<span className="caret-blink text-accent">_</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Defaults applied to every new invoice. Existing invoices aren't changed.</p>
        </div>
        <Button variant="primary" onClick={save} disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />} save settings
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-10">
        <Section label="business" hint="Shown in the “from” block of your invoices.">
          <Card label="profile">
            <div className="mb-4">
              <LogoInput value={form.logo} onChange={(logo) => set("logo", logo)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="name" className="col-span-2">
                <Input value={form.business.name} onChange={(e) => setBiz("name", e.target.value)} placeholder="Your business or full name" />
              </Field>
              <Field label="email">
                <Input type="email" value={form.business.email} onChange={(e) => setBiz("email", e.target.value)} placeholder="hello@example.com" />
              </Field>
              <Field label="phone">
                <Input type="tel" value={form.business.phone} onChange={(e) => setBiz("phone", e.target.value)} />
              </Field>
              <Field label="address" className="col-span-2">
                <Textarea rows={2} value={form.business.address} onChange={(e) => setBiz("address", e.target.value)} placeholder={"Street\nCity, Country"} />
              </Field>
              <Field label="tax_id" hint="optional" className="col-span-2">
                <Input value={form.business.taxId} onChange={(e) => setBiz("taxId", e.target.value)} placeholder="VAT / GST / EIN" />
              </Field>
            </div>
          </Card>
        </Section>

        <Section label="defaults" hint="Pre-filled on new invoices; you can still change them per invoice.">
          <Card label="invoice_defaults">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="currency">
                <Select className="font-mono" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="tax_rate" hint="%">
                <NumberInput value={form.taxRate} onValueChange={(v) => set("taxRate", Math.min(v, 100))} placeholder="0" />
              </Field>
              <Field label="payment_terms">
                <Select value={form.termsDays} onChange={(e) => set("termsDays", Number(e.target.value))}>
                  {PAYMENT_TERMS.filter((t) => t.days !== null).map((t) => (
                    <option key={t.label} value={t.days!}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="payment_info" className="col-span-2 md:col-span-3">
                <Textarea rows={3} value={form.paymentInfo} onChange={(e) => set("paymentInfo", e.target.value)} placeholder={"Bank: …\nIBAN / Account: …"} />
              </Field>
              <Field label="notes" className="col-span-2 md:col-span-3">
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Thanks for your business!" />
              </Field>
              <Field label="terms" className="col-span-2 md:col-span-3">
                <Textarea rows={2} value={form.terms} onChange={(e) => set("terms", e.target.value)} />
              </Field>
            </div>
          </Card>
        </Section>

        <Section label="numbering" hint="Numbers auto-increment when you save. {YYYY} becomes the issue year. Numbers never repeat.">
          <Card label="invoice_numbers">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="prefix">
                <Input className="font-mono" value={form.numberPrefix} onChange={(e) => set("numberPrefix", e.target.value)} placeholder="INV-{YYYY}-" />
              </Field>
              <Field label="digits">
                <Select className="font-mono" value={form.numberPadding} onChange={(e) => set("numberPadding", Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="next_number">
                <NumberInput value={nextNumber} onValueChange={(v) => setNextNumber(Math.max(1, Math.floor(v) || 1))} />
              </Field>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-bg px-3 py-2.5 font-mono text-xs">
              <span className="text-muted">next invoice →</span> <span className="text-accent">{formatInvoiceNumber(form, nextNumber)}</span>
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}
