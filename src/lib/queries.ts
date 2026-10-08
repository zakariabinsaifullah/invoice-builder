import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientSummary, InvoiceRecord, InvoiceStatus, InvoiceSummary, InvoiceWrite, ProfileResponse } from "@shared/api";
import type { Party } from "@shared/invoice";
import type { z } from "zod";
import type { profileUpdateSchema } from "@shared/api";
import type {
  TemplateRecord,
  TemplateSummary,
  templateCreateSchema,
  templatesFromInvoicesSchema,
  templateUpdateSchema,
} from "@shared/templates";

type TemplateCreate = z.input<typeof templateCreateSchema>;
type TemplateUpdate = z.input<typeof templateUpdateSchema>;
type TemplatesFromInvoices = z.input<typeof templatesFromInvoicesSchema>;
import { api, HttpError } from "./api";
import { useSession } from "./auth-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (n, err) => !(err instanceof HttpError && err.status < 500) && n < 2,
    },
  },
});

export const keys = {
  profile: ["profile"] as const,
  invoices: (f?: object) => (f ? (["invoices", f] as const) : (["invoices"] as const)),
  invoice: (id: string) => ["invoice", id] as const,
};

const useSignedIn = () => !!useSession().data;

// ── profile ──
export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api<ProfileResponse>("/profile"), enabled: useSignedIn() });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof profileUpdateSchema>) => api<ProfileResponse>("/profile", { method: "PUT", json: body }),
    onSuccess: (data) => qc.setQueryData(keys.profile, data),
  });
}

// ── invoices ──
export type InvoiceFilters = { status?: InvoiceStatus; q?: string };

export function useInvoices(filters: InvoiceFilters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  return useQuery({
    queryKey: keys.invoices(filters),
    queryFn: () => api<{ invoices: InvoiceSummary[] }>(`/invoices?${params}`).then((r) => r.invoices),
    enabled: useSignedIn(),
    placeholderData: (prev) => prev,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: keys.invoice(id ?? ""),
    queryFn: () => api<InvoiceRecord>(`/invoices/${id}`),
    enabled: useSignedIn() && !!id,
    refetchOnWindowFocus: false, // the editor owns the working copy; it re-syncs only when clean
  });
}

export function useSaveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: InvoiceWrite }) =>
      id ? api<InvoiceRecord>(`/invoices/${id}`, { method: "PUT", json: body }) : api<InvoiceRecord>("/invoices", { method: "POST", json: body }),
    onSuccess: (rec) => {
      qc.setQueryData(keys.invoice(rec.id), rec);
      qc.invalidateQueries({ queryKey: keys.invoices() });
      qc.invalidateQueries({ queryKey: keys.profile }); // counter may have advanced
      qc.invalidateQueries({ queryKey: clientsKey }); // bill-to may have become a saved client
    },
  });
}

export function useSetInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      api<InvoiceSummary>(`/invoices/${id}/status`, { method: "PATCH", json: { status } }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: keys.invoices() });
      qc.setQueryData<InvoiceRecord>(keys.invoice(s.id), (r) => (r ? { ...r, ...s } : r));
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/invoices/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.invoice(id) });
      qc.invalidateQueries({ queryKey: keys.invoices() });
    },
  });
}

export function useBulkDeleteInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<{ deleted: string[] }>("/invoices/bulk-delete", { method: "POST", json: { ids } }),
    onSuccess: ({ deleted }) => {
      deleted.forEach((id) => qc.removeQueries({ queryKey: keys.invoice(id) }));
      qc.invalidateQueries({ queryKey: keys.invoices() });
    },
  });
}

// ── templates ──
const templatesKey = ["templates"] as const;

export function useTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: () => api<{ templates: TemplateSummary[] }>("/templates").then((r) => r.templates),
    enabled: useSignedIn(),
  });
}

function useTemplateMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: templatesKey }) });
}

export const useCreateTemplate = () =>
  useTemplateMutation((body: TemplateCreate) => api<TemplateRecord>("/templates", { method: "POST", json: body }));

export const useTemplatesFromInvoices = () =>
  useTemplateMutation((body: TemplatesFromInvoices) =>
    api<{ templates: TemplateSummary[] }>("/templates/from-invoices", { method: "POST", json: body }),
  );

export const useUpdateTemplate = () =>
  useTemplateMutation(({ id, ...body }: { id: string } & TemplateUpdate) =>
    api<TemplateRecord>(`/templates/${id}`, { method: "PATCH", json: body }),
  );

export const useDuplicateTemplate = () =>
  useTemplateMutation((id: string) => api<TemplateRecord>(`/templates/${id}/duplicate`, { method: "POST" }));

export const useDeleteTemplate = () => useTemplateMutation((id: string) => api<void>(`/templates/${id}`, { method: "DELETE" }));

export const useUseTemplate = () =>
  useTemplateMutation((id: string) => api<TemplateRecord>(`/templates/${id}/use`, { method: "POST" }));

// ── clients ──
const clientsKey = ["clients"] as const;

export function useClients() {
  return useQuery({
    queryKey: clientsKey,
    queryFn: () => api<{ clients: ClientSummary[] }>("/clients").then((r) => r.clients),
    enabled: useSignedIn(),
  });
}

function useClientMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: clientsKey }) });
}

export const useSaveClient = () =>
  useClientMutation(({ id, ...party }: Party & { id?: string }) =>
    id ? api<ClientSummary>(`/clients/${id}`, { method: "PUT", json: party }) : api<ClientSummary>("/clients", { method: "POST", json: party }),
  );

export const useDeleteClient = () => useClientMutation((id: string) => api<void>(`/clients/${id}`, { method: "DELETE" }));
