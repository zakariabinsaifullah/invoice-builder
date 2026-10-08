import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { Party } from "@shared/invoice";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "./card";
import { useEditor } from "./store";

const MAX_LOGO_BYTES = 512 * 1024;

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
  const logo = useEditor((s) => s.invoice.style.logo);
  const set = useEditor((s) => s.set);
  const style = useEditor((s) => s.invoice.style);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const pick = (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) return setError("Use PNG, JPG, SVG or WebP.");
    if (file.size > MAX_LOGO_BYTES) return setError("Max 512 KB.");
    const reader = new FileReader();
    reader.onload = () => set("style", { ...style, logo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-border-strong bg-white/[.02] text-muted transition-colors hover:border-accent hover:text-accent"
        aria-label={logo ? "Change logo" : "Upload logo"}
      >
        {logo ? <img src={logo} alt="Logo" className="max-h-12 max-w-20 object-contain" /> : <ImagePlus className="size-5" />}
      </button>
      <div className="min-w-0 text-xs text-muted">
        <div className="font-mono text-text">logo</div>
        {error ? <div className="text-danger">{error}</div> : <div>PNG, JPG or SVG · max 512 KB</div>}
      </div>
      {logo && (
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => set("style", { ...style, logo: null })} aria-label="Remove logo">
          <X />
        </Button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

export function PartiesCard() {
  const from = useEditor((s) => s.invoice.from);
  const to = useEditor((s) => s.invoice.to);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card label="from">
        <LogoPicker />
        <PartyFields side="from" party={from} />
      </Card>
      <Card label="bill_to">
        <PartyFields side="to" party={to} />
      </Card>
    </div>
  );
}
