import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-muted/60 transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-20 resize-y py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(field, "h-9 appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (v: number) => void;
};

/** Numeric text field that keeps the user's in-progress text ("1.", "") while committing parsed numbers. */
export function NumberInput({ value, onValueChange, className, onBlur, ...props }: NumberInputProps) {
  const [text, setText] = useState(() => (value ? String(value) : ""));
  useEffect(() => {
    setText((t) => (parseNum(t) === value ? t : value ? String(value) : ""));
  }, [value]);
  return (
    <Input
      inputMode="decimal"
      className={cn("font-mono tabular", className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.]/g, "");
        setText(t);
        onValueChange(parseNum(t));
      }}
      onBlur={(e) => {
        setText(value ? String(value) : "");
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

function parseNum(t: string): number {
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-[11px] text-muted">
        {label}
        {hint && <span className="ml-1 opacity-60">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
