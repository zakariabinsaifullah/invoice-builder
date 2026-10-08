import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ label, action, children, className }: { label: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      <header className="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 className="font-mono text-xs text-muted">
          <span className="text-accent">//</span> {label}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
