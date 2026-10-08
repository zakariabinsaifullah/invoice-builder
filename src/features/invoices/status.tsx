import type { InvoiceStatus } from "@shared/api";
import { today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type DisplayStatus = InvoiceStatus | "overdue";

/** Sent invoices past their due date read as overdue. */
export function displayStatus(status: InvoiceStatus, dueDate: string): DisplayStatus {
  return status === "sent" && dueDate < today() ? "overdue" : status;
}

const STYLE: Record<DisplayStatus, string> = {
  draft: "text-muted border-border-strong",
  sent: "text-info border-info/40",
  paid: "text-accent border-accent/40",
  overdue: "text-warn border-warn/40",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none", STYLE[status], className)}>
      <span className="opacity-60">status:</span>
      {status}
    </span>
  );
}
