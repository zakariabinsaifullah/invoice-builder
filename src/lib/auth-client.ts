import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";

// Same origin: talks to /api/auth on the Worker.
export const authClient = createAuthClient();
export const { useSession, signIn, signOut } = authClient;

export type Provider = "github" | "google";

let providersPromise: Promise<Provider[]> | null = null;

function fetchProviders(): Promise<Provider[]> {
  providersPromise ??= fetch("/api/auth-config")
    .then((r) => (r.ok ? r.json() : { providers: [] }))
    .then((d: { providers: Provider[] }) => d.providers)
    .catch(() => {
      providersPromise = null;
      return [];
    });
  return providersPromise;
}

/** Sign-in providers configured on the server (null while loading). */
export function useProviders(): Provider[] | null {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchProviders().then((p) => alive && setProviders(p));
    return () => {
      alive = false;
    };
  }, []);
  return providers;
}
