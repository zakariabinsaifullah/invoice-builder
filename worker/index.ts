import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { configuredProviders, createAuth } from "./auth";
import type { AppEnv } from "./lib";
import { invoiceRoutes } from "./routes/invoices";
import { profileRoutes } from "./routes/profile";
import { templateRoutes } from "./routes/templates";
import { clientRoutes } from "./routes/clients";
import { exportRoute } from "./routes/export";
import { LOGO_KEY, readLogo } from "./logos";
import { getDb } from "./lib";

const app = new Hono<AppEnv>().basePath("/api");

// Baseline headers on every API response.
app.use("*", async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  if (!c.res.headers.has("cache-control")) c.header("cache-control", "no-store");
});

type Limiter = { limit: (o: { key: string }) => Promise<{ success: boolean }> };
const limited = (c: { header: (k: string, v: string) => void; json: (b: unknown, s: 429) => Response }) => {
  c.header("retry-after", "60");
  return c.json({ error: "rate_limited", message: "Too many requests — try again in a minute." }, 429);
};

// Sign-in / sign-out / callbacks: limit per client IP.
app.use("/auth/*", async (c, next) => {
  const limiter = (c.env as Env & { AUTH_LIMITER?: Limiter }).AUTH_LIMITER;
  if (limiter && c.req.method === "POST") {
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    if (!(await limiter.limit({ key: `auth:${ip}` })).success) return limited(c);
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true, service: "invoice-builder", time: new Date().toISOString() }));

// Which sign-in buttons the client should show.
app.get("/auth-config", (c) => c.json({ providers: configuredProviders(c.env) }));

app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

/** Rejects requests without a valid session; exposes the user as c.var.user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  // Writes are limited per user.
  const limiter = (c.env as Env & { WRITE_LIMITER?: Limiter }).WRITE_LIMITER;
  if (limiter && c.req.method !== "GET" && !(await limiter.limit({ key: `write:${session.user.id}` })).success) return limited(c);
  await next();
});

app.get("/me", requireUser, (c) => {
  const { id, name, email, image } = c.var.user;
  return c.json({ id, name, email, image });
});

app.use("/profile/*", requireUser);
app.use("/invoices/*", requireUser);
app.use("/templates/*", requireUser);
app.use("/clients/*", requireUser);
app.use("/export", requireUser);
app.route("/profile", profileRoutes);
app.route("/invoices", invoiceRoutes);
app.route("/templates", templateRoutes);
app.route("/clients", clientRoutes);
app.route("/export", exportRoute);

// Stored logos are public by unguessable, content-addressed key (they're printed on invoices anyway).
app.get("/logos/:user/:file", async (c) => {
  const key = `${c.req.param("user")}/${c.req.param("file")}`;
  if (!LOGO_KEY.test(key)) return c.json({ error: "not_found" }, 404);
  const logo = await readLogo(c.env, getDb(c.env), key);
  if (!logo) return c.json({ error: "not_found" }, 404);
  return c.body(logo.body as ArrayBuffer, 200, {
    "content-type": logo.contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
