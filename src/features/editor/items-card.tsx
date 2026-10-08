import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { currencyDigits, formatMinor, lineAmountMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { useEditor } from "./store";


export function ItemsCard() {
  const items = useEditor((s) => s.invoice.items);
  const currency = useEditor((s) => s.invoice.currency);
  const { addItem, updateItem, removeItem, duplicateItem, moveItem } = useEditor.getState();
  const digits = currencyDigits(currency);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  // Focus a row's description after the render that creates/moves it.
  const pendingFocus = useRef<string | null>(null);
  const focusDesc = (id: string) => (pendingFocus.current = id);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    document.querySelector<HTMLInputElement>(`[data-desc="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });

  const onDescKey = (e: KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusDesc(addItem(id));
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveItem(index, index + (e.key === "ArrowUp" ? -1 : 1));
      focusDesc(id);
    } else if (e.key === "Backspace" && !e.currentTarget.value && items.length > 1) {
      e.preventDefault();
      removeItem(id);
      const prev = items[index - 1] ?? items[index + 1];
      if (prev) focusDesc(prev.id);
    }
  };

  return (
    <Card
      label="items"
      action={
        <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex">
          <Kbd>↵</Kbd> new row · <Kbd>⌥</Kbd>
          <Kbd>↑↓</Kbd> move
        </span>
      }
    >
      <div className="hidden grid-cols-[20px_minmax(0,1fr)_72px_112px_112px_64px] gap-2 px-1 pb-2 font-mono text-[11px] text-muted md:grid">
        <span />
        <span>description</span>
        <span className="text-right">qty</span>
        <span className="text-right">rate</span>
        <span className="text-right">amount</span>
        <span />
      </div>

      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              if (drag.over !== index) setDrag({ ...drag, over: index });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) moveItem(drag.from, index);
              setDrag(null);
            }}
            className={cn(
              "group grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg p-1 transition-colors md:grid-cols-[20px_minmax(0,1fr)_72px_112px_112px_64px]",
              drag?.over === index && drag.from !== index && "bg-accent-soft",
              drag?.from === index && "opacity-40",
            )}
          >
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                const row = e.currentTarget.closest("li");
                if (row) e.dataTransfer.setDragImage(row, 12, 18);
                setDrag({ from: index, over: index });
              }}
              onDragEnd={() => setDrag(null)}
              className="flex cursor-grab items-center justify-center text-muted/50 hover:text-muted active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="size-4" />
            </span>

            <Input
              data-desc={item.id}
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              onKeyDown={(e) => onDescKey(e, item.id, index)}
              placeholder={`Item ${index + 1} description`}
              aria-label={`Item ${index + 1} description`}
            />

            <div className="col-span-2 col-start-2 row-start-2 grid grid-cols-3 gap-2 md:col-span-3 md:col-start-3 md:row-start-1 md:grid-cols-[72px_112px_112px]">
              <NumberInput
                value={item.quantity}
                onValueChange={(quantity) => updateItem(item.id, { quantity })}
                className="text-right"
                placeholder="1"
                aria-label="Quantity"
              />
              <NumberInput
                value={item.rate}
                onValueChange={(rate) => updateItem(item.id, { rate })}
                className="text-right"
                placeholder="0.00"
                aria-label="Rate"
              />
              <div className="flex h-9 items-center justify-end truncate px-1 font-mono text-sm tabular text-text">
                {formatMinor(lineAmountMinor(item, digits), currency, digits)}
              </div>
            </div>
            {/* after qty/rate in tab order; placed beside description on mobile, last column on desktop */}
            <div className="col-start-3 row-start-1 flex justify-end gap-0.5 md:col-start-6">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => duplicateItem(item.id)} aria-label="Duplicate item">
                <Copy className="size-3.5!" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-danger"
                onClick={() => removeItem(item.id)}
                aria-label="Delete item"
              >
                <Trash2 className="size-3.5!" />
              </Button>
            </div>

          </li>
        ))}
      </ol>

      <Button variant="ghost" size="sm" className="mt-3 font-mono text-xs" onClick={() => focusDesc(addItem())}>
        <Plus /> add_item
      </Button>
    </Card>
  );
}
