import { useNavigate } from "react-router";
import { applyTemplate } from "@shared/templates";
import { toast } from "@/components/toaster";
import { blankInvoice, invoiceFromProfile, newId, useEditor } from "@/features/editor/store";
import { useProfile, useUseTemplate } from "@/lib/queries";

/** Returns a function that opens a new invoice pre-filled from a template (fresh number + today's date). */
export function useStartFromTemplate() {
  const navigate = useNavigate();
  const profile = useProfile().data;
  const use = useUseTemplate();

  const start = async (id: string) => {
    try {
      const tpl = await use.mutateAsync(id);
      const base = profile ? invoiceFromProfile(profile) : blankInvoice();
      useEditor.getState().startFromTemplate(applyTemplate(base, tpl.data, newId), tpl.id);
      navigate("/");
      toast.success(`New invoice from “${tpl.name}”`);
    } catch {
      toast.error("Couldn't load that template.");
    }
  };

  return { start, pendingId: use.isPending ? use.variables : undefined };
}
