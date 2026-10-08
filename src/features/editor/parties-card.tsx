import type { Party } from "@shared/invoice";
import { LogoInput } from "@/components/logo-input";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "./card";
import { useEditor } from "./store";

function PartyFields({ side, party }: { side: "from" | "to"; party: Party }) {
  const setParty = useEditor((s) => s.setParty);
  const on = (k: keyof Party) => (e: { target: { value: string } }) => setParty(side, { [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="name" className="col-span-2">
        <Input value={party.name} onChange={on("name")} placeholder={side === "from" ? "Your business or full name" : "Client or company"} />
      </Field>
      <Field label="email">
        <Input type="email" value={party.email} onChange={on("email")} placeholder="hello@example.com" />
      </Field>
      <Field label="phone">
        <Input type="tel" value={party.phone} onChange={on("phone")} placeholder="+1 555 0100" />
      </Field>
      <Field label="address" className="col-span-2">
        <Textarea rows={2} className="min-h-0" value={party.address} onChange={on("address")} placeholder={"Street\nCity, Country"} />
      </Field>
      <Field label="tax_id" hint="optional" className="col-span-2">
        <Input value={party.taxId} onChange={on("taxId")} placeholder="VAT / GST / EIN" />
      </Field>
    </div>
  );
}

function LogoPicker() {
  const style = useEditor((s) => s.invoice.style);
  const set = useEditor((s) => s.set);
  return <LogoInput value={style.logo} onChange={(logo) => set("style", { ...style, logo })} />;
}

export function PartiesCard() {
  const from = useEditor((s) => s.invoice.from);
  const to = useEditor((s) => s.invoice.to);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card label="from">
        <div className="mb-4">
          <LogoPicker />
        </div>
        <PartyFields side="from" party={from} />
      </Card>
      <Card label="bill_to">
        <PartyFields side="to" party={to} />
      </Card>
    </div>
  );
}
