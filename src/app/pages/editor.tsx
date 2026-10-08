import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router";
import { Download, Eye, LayoutTemplate, Loader2, Lock, PencilLine, Printer, RotateCcw, Save } from "lucide-react";
import type { InvoiceStatus } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "@/components/toaster";
import { useSignInDialog } from "@/features/auth/sign-in-dialog";
import { DetailsCard } from "@/features/editor/details-card";
import { ItemsCard } from "@/features/editor/items-card";
import { PartiesCard } from "@/features/editor/parties-card";
import { invoiceFromProfile, snapshot, useEditor } from "@/features/editor/store";
import { StyleCard } from "@/features/editor/style-card";
import { SummaryCard } from "@/features/editor/summary-card";
import { displayStatus, StatusBadge } from "@/features/invoices/status";
import { InvoiceDocument } from "@/features/preview/invoice-document";
import { ScaledPreview } from "@/features/preview/scaled-preview";
import { QuickStart } from "@/features/templates/quick-start";
import { useSaveTemplateDialog } from "@/features/templates/save-template-dialog";
import { HttpError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { onEditorCommand } from "@/lib/commands";
import { useInvoice, useProfile, useSaveInvoice, useSetInvoiceStatus } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Keeps the editor store in sync with the route: `/` = new invoice, `/invoices/:id` = saved invoice. */
function useRouteDocument(id: string | undefined) {
  const signedIn = !!useSession().data;
  const profile = useProfile().data;
  const record = useInvoice(id);
  const savedId = useEditor((s) => s.savedId);
  const fresh = useEditor((s) => s.fresh);
  const { reset, load } = useEditor.getState();

  // Opening a saved invoice — or refreshing our copy when the server's is newer and we have no unsaved edits
  // (e.g. it was marked paid from the list). Status always follows the server.
  useEffect(() => {
    const rec = record.data;
    if (!id || !rec) return;
    const s = useEditor.getState();
    const clean = s.savedSnapshot === snapshot(s.invoice);
    if (s.savedId !== id || (clean && rec.updatedAt > (s.savedAt ?? 0))) load(rec);
    else if (s.status !== rec.status) s.setStatus(rec.status);
  }, [id, record.data, load]);

  // Arriving at "new" while a saved invoice is loaded → start a new one.
  useEffect(() => {
    if (!id && savedId) reset(profile ? invoiceFromProfile(profile) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Untouched new draft + signed in → prefill from profile (business, defaults, next number).
  useEffect(() => {
    if (id || !signedIn || !profile || !fresh) return;
    const next = invoiceFromProfile(profile);
    if (snapshot(next) !== snapshot(useEditor.getState().invoice)) reset(next);
  }, [id, signedIn, profile, fresh, reset]);

  return record;
}

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = useRouteDocument(id);
  const invoice = useEditor((s) => s.invoice);
  const savedId = useEditor((s) => s.savedId);
  const status = useEditor((s) => s.status);
  const savedAt = useEditor((s) => s.savedAt);
  const dirty = useEditor((s) => s.savedSnapshot !== snapshot(s.invoice));
  const profile = useProfile().data;
  const signedIn = !!useSession().data;
  const showSignIn = useSignInDialog((s) => s.show);
  const showSaveTemplate = useSaveTemplateDialog((s) => s.show);
  const saveAsTemplate = () => (signedIn ? showSaveTemplate({ kind: "editor" }) : showSignIn("save templates and reuse them"));
  const saveMutation = useSaveInvoice();
  const statusMutation = useSetInvoiceStatus();

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [confirmNew, setConfirmNew] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000); // refresh "saved 2m ago"
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!confirmNew) return;
    const t = setTimeout(() => setConfirmNew(false), 3000);
    return () => clearTimeout(t);
  }, [confirmNew]);

  const save = async () => {
    if (!signedIn) return showSignIn("save this invoice");
    if (saveMutation.isPending) return;
    const s = useEditor.getState();
    try {
      const sent = s.invoice;
      const rec = await saveMutation.mutateAsync({
        id: s.savedId,
        // Status is only changed through the status control (PATCH), never by saving content.
        body: { data: sent, templateId: s.templateId },
      });
      useEditor.getState().markSaved(rec, sent);
      toast.success(`Saved ${rec.number}`);
      if (!id) navigate(`/invoices/${rec.id}`, { replace: true });
    } catch (err) {
      if (err instanceof HttpError && err.body.error === "number_taken") {
        const suggestion = String(err.body.suggestion ?? "");
        toast.error(`${s.invoice.number} is already used.`, suggestion ? { label: `use ${suggestion}`, run: () => (useEditor.getState().set("number", suggestion), void saveRef.current()) } : undefined);
      } else if (err instanceof HttpError && err.body.error === "validation_failed") {
        toast.error("Some fields are invalid — check dates and amounts.");
      } else {
        toast.error("Couldn't save. Check your connection and try again.");
      }
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const changeStatus = async (next: InvoiceStatus) => {
    const prev = useEditor.getState().status;
    useEditor.getState().setStatus(next);
    if (!savedId) return;
    try {
      await statusMutation.mutateAsync({ id: savedId, status: next });
    } catch {
      useEditor.getState().setStatus(prev);
      toast.error("Couldn't update status.");
    }
  };

  const loadPdf = () => import("@/features/preview/pdf/download");
  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadInvoicePdf } = await loadPdf();
      await downloadInvoicePdf(useEditor.getState().invoice);
    } catch (err) {
      console.error(err);
      toast.error("PDF generation failed — try again, or use print → Save as PDF.");
    } finally {
      setPdfBusy(false);
    }
  };
  const downloadRef = useRef(downloadPdf);
  downloadRef.current = downloadPdf;

  const templateRef = useRef(saveAsTemplate);
  templateRef.current = saveAsTemplate;
  useEffect(
    () =>
      onEditorCommand((cmd) => {
        if (cmd === "save") void saveRef.current();
        else if (cmd === "pdf") void downloadRef.current();
        else if (cmd === "print") setTimeout(() => window.print(), 50); // let the palette close first
        else if (cmd === "template") templateRef.current();
      }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void saveRef.current();
      } else if (key === "e" && e.shiftKey) {
        e.preventDefault();
        void downloadRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startNew = () => {
    if (dirty && signedIn && !confirmNew) return setConfirmNew(true);
    if (!signedIn && !confirmNew) return setConfirmNew(true);
    setConfirmNew(false);
    useEditor.getState().reset(profile ? invoiceFromProfile(profile) : undefined);
    if (id) navigate("/");
  };

  if (id && record.isError) {
    const notFound = record.error instanceof HttpError && record.error.status === 404;
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="font-mono text-xs text-muted">~/invoices/{id.slice(0, 8)}</div>
        <h1 className="mt-2 font-mono text-xl font-semibold">{notFound ? "invoice not found" : "couldn't load invoice"}</h1>
        <Button className="mt-6" onClick={() => navigate("/invoices")}>
          back to invoices
        </Button>
      </div>
    );
  }
  if (id && savedId !== id) {
    return (
      <div className="grid h-64 place-items-center text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const title = `${invoice.number || "untitled"}${invoice.to.name ? ` · ${invoice.to.name}` : ""}`;
  const saveState = !signedIn
    ? null
    : saveMutation.isPending
      ? "saving…"
      : !savedId
        ? "not saved yet"
        : dirty
          ? "unsaved changes"
          : `saved ${savedAt ? timeAgo(savedAt) : ""}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <span>{savedId ? "~/invoices" : "~/new_invoice"}</span>
            {saveState && (
              <span className={cn("hidden sm:inline", dirty && savedId && "text-warn")}>
                · {saveState}
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-mono text-base font-semibold tracking-tight">{title}</h1>
            {savedId && (
              <label className="relative shrink-0">
                <span className="sr-only">Status</span>
                <StatusBadge status={displayStatus(status, invoice.dueDate)} className="cursor-pointer" />
                <select
                  value={status}
                  onChange={(e) => changeStatus(e.target.value as InvoiceStatus)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Change status"
                >
                  <option value="draft">draft</option>
                  <option value="sent">sent</option>
                  <option value="paid">paid</option>
                </select>
              </label>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={startNew}
            className={cn(confirmNew && "text-danger hover:text-danger")}
            title="Start a new invoice"
          >
            <RotateCcw /> <span className="hidden lg:inline">{confirmNew ? (savedId && !dirty ? "click again" : "discard changes?") : "new"}</span>
          </Button>
          <Button
            variant={signedIn && dirty ? "secondary" : "ghost"}
            size="sm"
            onClick={save}
            disabled={saveMutation.isPending}
            title={signedIn ? "Save (⌘S)" : "Sign in to save"}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            <span className="hidden lg:inline">save</span>
            {!signedIn && <Lock className="hidden size-3! opacity-60 sm:inline" />}
            {signedIn && dirty && <span className="size-1.5 rounded-full bg-warn" aria-label="Unsaved changes" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={saveAsTemplate} title="Save as template">
            <LayoutTemplate /> <span className="hidden lg:inline">template</span>
            {!signedIn && <Lock className="hidden size-3! opacity-60 sm:inline" />}
          </Button>
          <Button size="sm" onClick={() => window.print()} title="Print (⌘P)">
            <Printer /> <span className="hidden sm:inline">print</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={downloadPdf}
            onPointerEnter={() => void loadPdf()}
            disabled={pdfBusy}
            title="Download PDF (⌘⇧E)"
          >
            {pdfBusy ? <Loader2 className="animate-spin" /> : <Download />}
            <span className="hidden sm:inline">{pdfBusy ? "rendering…" : "pdf"}</span>
          </Button>
        </div>
      </header>

      {/* mobile / tablet view switch */}
      <div className="sticky top-[61px] z-10 flex justify-center border-b border-border bg-bg/90 py-2 backdrop-blur xl:hidden">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 font-mono text-xs">
          {(
            [
              ["edit", PencilLine],
              ["preview", Eye],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 transition-colors",
                tab === key ? "bg-accent-soft text-text" : "text-muted hover:text-text",
              )}
            >
              <Icon className="size-3.5" /> {key}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn("flex flex-col gap-4 p-4 md:p-6", tab !== "edit" && "hidden xl:flex")}>
          {signedIn && <QuickStart />}
          <DetailsCard />
          <PartiesCard />
          <ItemsCard />
          <SummaryCard />
          <StyleCard />
          <p className="pb-4 text-center font-mono text-[11px] text-muted">
            {signedIn ? (
              <>
                <Kbd>⌘</Kbd>
                <Kbd>S</Kbd> save ·{" "}
              </>
            ) : (
              "guest draft lives in this tab only · "
            )}
            <Kbd>⌘</Kbd>
            <Kbd>P</Kbd> print · <Kbd>⌘</Kbd>
            <Kbd>⇧</Kbd>
            <Kbd>E</Kbd> pdf
          </p>
        </div>

        <aside className={cn("border-border bg-surface-2/60 xl:border-l", tab !== "preview" && "hidden xl:block")}>
          <div className="p-4 md:p-6 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-61px)] xl:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-muted">
              <span>
                <span className="text-accent">●</span> live_preview
              </span>
              <span>A4 · {invoice.currency}</span>
            </div>
            <div className="mx-auto max-w-[680px]">
              <ScaledPreview invoice={invoice} />
            </div>
          </div>
        </aside>
      </div>

      {createPortal(
        <div id="print-root">
          <InvoiceDocument invoice={invoice} />
        </div>,
        document.body,
      )}
    </div>
  );
}
