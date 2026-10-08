import type { ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useSignInDialog } from "./sign-in-dialog";

/** Renders children for signed-in users; otherwise a sign-in prompt. */
export function RequireAuth({ title, reason, children }: { title: string; reason: string; children: ReactNode }) {
  const { data, isPending } = useSession();
  const show = useSignInDialog((s) => s.show);

  if (isPending)
    return (
      <div className="grid h-64 place-items-center text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (data) return children;

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center md:px-8">
      <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-surface">
        <Lock className="size-5 text-accent" />
      </div>
      <div className="mt-5 font-mono text-xs text-muted">~/{title}</div>
      <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">sign in required</h1>
      <p className="mt-3 text-sm text-muted">Sign in to {reason}. Creating and downloading invoices stays free without an account.</p>
      <Button variant="primary" className="mt-6 font-mono" onClick={() => show(reason)}>
        sign_in()
      </Button>
    </div>
  );
}
