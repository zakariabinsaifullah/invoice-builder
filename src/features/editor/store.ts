import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { InvoiceData, LineItem, Party } from "@shared/invoice";
import { addDays, today } from "@/lib/dates";

export const newId = () => crypto.randomUUID();

export const emptyParty = (): Party => ({ name: "", email: "", phone: "", address: "", taxId: "" });

export const newItem = (): LineItem => ({ id: newId(), description: "", quantity: 1, rate: 0 });

export function blankInvoice(): InvoiceData {
  const issue = today();
  return {
    number: "INV-0001",
    issueDate: issue,
    termsDays: 14,
    dueDate: addDays(issue, 14),
    currency: "USD",
    from: emptyParty(),
    to: emptyParty(),
    items: [newItem()],
    taxRate: 0,
    discount: { type: "percent", value: 0 },
    shipping: 0,
    notes: "",
    paymentInfo: "",
    terms: "",
    style: { layout: "mono", logo: null },
  };
}

type EditorState = {
  invoice: InvoiceData;
  set: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
  setParty: (side: "from" | "to", patch: Partial<Party>) => void;
  setIssueDate: (date: string) => void;
  setTerms: (days: number | null) => void;
  setDueDate: (date: string) => void;
  addItem: (afterId?: string) => string;
  updateItem: (id: string, patch: Partial<LineItem>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  moveItem: (from: number, to: number) => void;
  reset: () => void;
};

export const useEditor = create<EditorState>()(
  persist(
    (set) => {
      const patch = (fn: (inv: InvoiceData) => Partial<InvoiceData>) => set((s) => ({ invoice: { ...s.invoice, ...fn(s.invoice) } }));
      return {
        invoice: blankInvoice(),
        set: (key, value) => patch(() => ({ [key]: value })),
        setParty: (side, p) => patch((inv) => ({ [side]: { ...inv[side], ...p } })),
        setIssueDate: (issueDate) =>
          patch((inv) => ({ issueDate, dueDate: inv.termsDays === null ? inv.dueDate : addDays(issueDate, inv.termsDays) })),
        setTerms: (termsDays) =>
          patch((inv) => ({ termsDays, dueDate: termsDays === null ? inv.dueDate : addDays(inv.issueDate, termsDays) })),
        setDueDate: (dueDate) => patch(() => ({ dueDate, termsDays: null })),
        addItem: (afterId) => {
          const item = newItem();
          patch((inv) => {
            const idx = afterId ? inv.items.findIndex((i) => i.id === afterId) : -1;
            const items = [...inv.items];
            items.splice(idx === -1 ? items.length : idx + 1, 0, item);
            return { items };
          });
          return item.id;
        },
        updateItem: (id, p) => patch((inv) => ({ items: inv.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })),
        removeItem: (id) =>
          patch((inv) => {
            const items = inv.items.filter((i) => i.id !== id);
            return { items: items.length ? items : [newItem()] };
          }),
        duplicateItem: (id) =>
          patch((inv) => {
            const idx = inv.items.findIndex((i) => i.id === id);
            if (idx === -1) return {};
            const items = [...inv.items];
            items.splice(idx + 1, 0, { ...inv.items[idx], id: newId() });
            return { items };
          }),
        moveItem: (from, to) =>
          patch((inv) => {
            if (from === to || to < 0 || to >= inv.items.length) return {};
            const items = [...inv.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
            return { items };
          }),
        reset: () => set({ invoice: blankInvoice() }),
      };
    },
    {
      // Guests: keep the draft for this tab only (survives refresh, never leaves the browser).
      name: "ib:draft",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
