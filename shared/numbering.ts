// Pure helpers (no zod) so the client bundle stays small.
import type { Profile } from "./api";

export function formatInvoiceNumber(p: Pick<Profile, "numberPrefix" | "numberPadding">, n: number, year = new Date().getFullYear()) {
  return p.numberPrefix.replaceAll("{YYYY}", String(year)) + String(n).padStart(p.numberPadding, "0");
}

/** If `number` follows the profile pattern, the sequence value it uses (else null). */
export function parseInvoiceNumber(p: Pick<Profile, "numberPrefix">, number: string, year: number): number | null {
  const prefix = p.numberPrefix.replaceAll("{YYYY}", String(year));
  if (!number.startsWith(prefix)) return null;
  const rest = number.slice(prefix.length);
  return /^\d{1,9}$/.test(rest) ? Number(rest) : null;
}
