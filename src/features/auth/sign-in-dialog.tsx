import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, useProviders, type Provider } from "@/lib/auth-client";
import { GitHubIcon, GoogleIcon } from "./brand-icons";

type DialogState = { open: boolean; reason: string; show: (reason?: string) => void; hide: () => void };

export const useSignInDialog = create<DialogState>((set) => ({
  open: false,
  reason: "",
  show: (reason = "") => set({ open: true, reason }),
  hide: () => set({ open: false }),
}));

const PERKS = ["Save invoices & templates", "One-click quick invoices", "Saved clients & business profile"];

const PROVIDER_UI: Record<Provider, { label: string; Icon: typeof GitHubIcon }> = {
  github: { label: "Continue with GitHub", Icon: GitHubIcon },
  google: { label: "Continue with Google", Icon: GoogleIcon },
};

export function SignInDialog() {
  const { open, reason, hide } = useSignInDialog();
  const providers = useProviders();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError("");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const go = async (provider: Provider) => {
    setPending(provider);
    setError("");
    // The guest draft lives in sessionStorage, so it survives the OAuth round-trip in this tab.
    const { error } = await signIn.social({ provider, callbackURL: location.pathname + location.search });
    if (error) {
      setError(error.message || "Sign-in failed. Try again.");
      setPending(null);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={hide}
      onClick={(e) => e.target === ref.current && hide()}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-xl border border-border-strong bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative p-6">
        <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={hide} aria-label="Close">
          <X />
        </Button>
        <div className="font-mono text-xs text-muted">
          <span className="text-accent">$</span> auth login
        </div>
        <h2 className="mt-2 font-mono text-xl font-semibold tracking-tight">
          sign_in<span className="text-accent">()</span>
        </h2>
        <p className="mt-2 text-sm text-muted">{reason ? `Sign in to ${reason}.` : "Sign in to save your work and reuse it later."}</p>

        <ul className="mt-4 space-y-1.5 font-mono text-xs">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 text-muted">
              <Check className="size-3.5 text-accent" /> {p}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          {providers === null ? (
            <div className="flex h-10 items-center justify-center text-muted">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : providers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-3 text-center font-mono text-xs text-muted">
              sign-in isn't configured on this server yet
            </p>
          ) : (
            providers.map((p) => {
              const { label, Icon } = PROVIDER_UI[p];
              return (
                <Button key={p} className="h-10 w-full" onClick={() => go(p)} disabled={pending !== null}>
                  {pending === p ? <Loader2 className="animate-spin" /> : <Icon className="size-4" />}
                  {label}
                </Button>
              );
            })
          )}
          {error && <p className="text-center text-xs text-danger">{error}</p>}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
          Your current draft stays put while you sign in.
          <br />
          One account works across all tinytools.
        </p>
      </div>
    </dialog>
  );
}
