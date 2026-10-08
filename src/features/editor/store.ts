import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { InvoiceRecord, InvoiceStatus, ProfileResponse } from "@shared/api";
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

/** A new invoice pre-filled from the signed-in user's profile and numbering. */
export function invoiceFromProfile({ profile: p, nextInvoiceNumber }: ProfileResponse): InvoiceData {
  const base = blankInvoice();
  return {
    ...base,
    number: nextInvoiceNumber,
    termsDays: p.termsDays,
    dueDate: addDays(base.issueDate, p.termsDays),
    currency: p.currency,
    from: { ...p.business },
    taxRate: p.taxRate,
    notes: p.notes,
    paymentInfo: p.paymentInfo,
    terms: p.terms,
    style: { ...base.style, logo: p.logo, layout: p.layout ?? "mono", ...(p.accent && { accent: p.accent }) },
  };
}

export const snapshot = (inv: InvoiceData) => JSON.stringify(inv);

type EditorState = {
  invoice: InvoiceData;
  /** Server id once saved; null for an unsaved draft. */
  savedId: string | null;
  status: InvoiceStatus;
  templateId: string | null;
  /** JSON of the invoice as last saved — compare to detect unsaved changes. */
  savedSnapshot: string | null;
  savedAt: number | null;
  /** Untouched since reset: safe to replace with profile defaults. */
  fresh: boolean;
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
  reset: (base?: InvoiceData) => void;
  /** Start a new (unsaved), already-filled invoice — from a template or for a client. */
  startFromTemplate: (inv: InvoiceData, templateId: string | null) => void;
  load: (rec: InvoiceRecord) => void;
  markSaved: (rec: InvoiceRecord, sent: InvoiceData) => void;
  setStatus: (status: InvoiceStatus) => void;
};

export const useEditor = create<EditorState>()(
  persist(
    (set) => {
      const patch = (fn: (inv: InvoiceData) => Partial<InvoiceData>) =>
        set((s) => ({ invoice: { ...s.invoice, ...fn(s.invoice) }, fresh: false }));
      const unsaved = { savedId: null, status: "draft" as const, templateId: null, savedSnapshot: null, savedAt: null };
      return {
        invoice: blankInvoice(),
        ...unsaved,
        fresh: true,
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
        reset: (base) => set({ invoice: base ?? blankInvoice(), ...unsaved, fresh: true }),
        startFromTemplate: (inv, templateId) => set({ invoice: inv, ...unsaved, templateId, fresh: false }),
        load: (rec) =>
          set({
            invoice: rec.data,
            savedId: rec.id,
            status: rec.status,
            templateId: rec.templateId,
            savedSnapshot: snapshot(rec.data),
            savedAt: rec.updatedAt,
            fresh: false,
          }),
        // Adopt the server's normalized copy (e.g. logo data URL → stored path) unless the user
        // kept typing while the request was in flight — then keep their edits (they show as unsaved).
        markSaved: (rec, sent) =>
          set((s) => ({
            savedId: rec.id,
            status: rec.status,
            savedSnapshot: snapshot(rec.data),
            savedAt: rec.updatedAt,
            ...(snapshot(s.invoice) === snapshot(sent) && { invoice: rec.data }),
          })),
        setStatus: (status) => set({ status }),
      };
    },
    {
      // Guests: keep the draft for this tab only (survives refresh, never leaves the browser).
      name: "ib:draft",
      version: 2,
      // v1 stored only the invoice; the rest falls back to defaults.
      migrate: (old) => old as EditorState,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
