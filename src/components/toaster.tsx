import { useEffect } from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "info" | "success" | "error"; action?: { label: string; run: () => void } };

type ToastState = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void };

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: ++seq }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (message: string, action?: Toast["action"]) => useToasts.getState().push({ message, tone: "info", action }),
  success: (message: string) => useToasts.getState().push({ message, tone: "success" }),
  error: (message: string, action?: Toast["action"]) => useToasts.getState().push({ message, tone: "error", action }),
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.action ? 8000 : 3500);
    return () => clearTimeout(timer);
  }, [t, dismiss]);
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-border-strong bg-surface px-4 py-2.5 font-mono text-xs shadow-lg">
      <span className={cn(t.tone === "error" ? "text-danger" : "text-accent")}>{t.tone === "error" ? "✕" : t.tone === "success" ? "✓" : "→"}</span>
      <span>{t.message}</span>
      {t.action && (
        <button
          className="ml-1 rounded border border-border-strong px-2 py-0.5 text-accent hover:bg-accent-soft"
          onClick={() => {
            t.action!.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 [&>*]:pointer-events-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
