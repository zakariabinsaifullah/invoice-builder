import { eq } from "drizzle-orm";
import { asset } from "./db/schema";
import type { Db } from "./lib";

/** Optional R2 bucket. Without it, logos are stored in D1 (`asset` table). */
type LogoEnv = Env & { LOGOS?: R2Bucket };

const DATA_URL = /^data:image\/(png|jpeg);base64,(.+)$/;
export const LOGO_KEY = /^[\w-]+\/[a-f0-9]{64}\.(png|jpeg)$/;

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * If `logo` is a data URL, store the image once (content-addressed, so the same logo is never
 * duplicated) and return its `/api/logos/...` path. Paths and null pass through unchanged.
 */
export async function externalizeLogo<T extends string | null | undefined>(env: Env, db: Db, userId: string, logo: T): Promise<T | string> {
  const m = typeof logo === "string" ? DATA_URL.exec(logo) : null;
  if (!m) return logo;
  const [, ext, b64] = m;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = `${userId}/${await sha256Hex(bytes)}.${ext}`;
  const contentType = `image/${ext}`;
  const bucket = (env as LogoEnv).LOGOS;
  if (bucket) {
    await bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  } else {
    await db.insert(asset).values({ key, userId, contentType, data: Buffer.from(bytes) }).onConflictDoNothing();
  }
  return `/api/logos/${key}`;
}

export async function readLogo(env: Env, db: Db, key: string): Promise<{ body: BodyInit; contentType: string } | null> {
  const bucket = (env as LogoEnv).LOGOS;
  if (bucket) {
    const obj = await bucket.get(key);
    return obj ? { body: obj.body, contentType: obj.httpMetadata?.contentType ?? "image/png" } : null;
  }
  const row = await db.select({ data: asset.data, contentType: asset.contentType }).from(asset).where(eq(asset.key, key)).get();
  return row ? { body: new Uint8Array(row.data), contentType: row.contentType } : null;
}
