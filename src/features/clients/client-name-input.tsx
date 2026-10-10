import { useId, useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { Party } from "@shared/invoice";
import { Input } from "@/components/ui/input";
import { partyFrom } from "@/features/editor/store";
import { useSession } from "@/lib/auth-client";
import { useClients } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Bill-to name field that suggests saved clients; picking one fills every bill-to field. */
export function ClientNameInput({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (p: Party) => void }) {
  const signedIn = !!useSession().data;
  const { data: clients } = useClients();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const matches = useMemo(() => {
    if (!clients?.length) return [];
    const q = value.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .filter((c) => c.name.toLowerCase() !== q) // already exactly picked
      .slice(0, 6);
  }, [clients, value]);

  const show = signedIn && open && matches.length > 0;
  const pick = (i: number) => {
    const c = matches[i];
    if (!c) return;
    onPick(partyFrom(c));
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => (a + 1) % matches.length));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => (a - 1 + matches.length) % matches.length));
          else if (e.key === "Enter") (e.preventDefault(), pick(active));
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={signedIn && clients?.length ? "Client name — or pick a saved client" : "Client or company"}
      />
      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border-strong bg-surface py-1 shadow-xl"
        >
          <li className="px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">saved clients</li>
          {matches.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => (e.preventDefault(), pick(i))}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2", i === active && "bg-accent-soft")}
            >
              <Users className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.name}</span>
                {c.email && <span className="block truncate font-mono text-[11px] text-muted">{c.email}</span>}
              </span>
              {c.invoiceCount > 0 && <span className="font-mono text-[10px] text-muted">{c.invoiceCount} inv</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
