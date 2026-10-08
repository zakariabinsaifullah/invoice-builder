import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** Modal built on <dialog>: focus trapping, Esc and backdrop-click to close come for free. */
export function Dialog({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      className="m-auto max-h-[calc(100vh-32px)] rounded-xl border border-border-strong bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex max-h-[calc(100vh-34px)] flex-col">
          <div className="relative px-6 pb-2 pt-6">
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Close">
              <X />
            </Button>
            {kicker && (
              <div className="font-mono text-xs text-muted">
                <span className="text-accent">$</span> {kicker}
              </div>
            )}
            <h2 className="mt-1.5 pr-8 font-mono text-lg font-semibold tracking-tight">{title}</h2>
          </div>
          <div className="overflow-y-auto px-6 py-3">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
