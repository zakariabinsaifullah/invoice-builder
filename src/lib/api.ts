import type { ApiError } from "@shared/api";

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: ApiError & Record<string, unknown>,
  ) {
    super(body.message || body.error || `HTTP ${status}`);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: { ...(json !== undefined && { "content-type": "application/json" }), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: "bad_response" }));
  if (!res.ok) throw new HttpError(res.status, body);
  return body as T;
}
