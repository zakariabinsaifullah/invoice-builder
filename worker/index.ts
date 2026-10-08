import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { configuredProviders, createAuth } from "./auth";
import type { AppEnv } from "./lib";
import { invoiceRoutes } from "./routes/invoices";
import { profileRoutes } from "./routes/profile";

const app = new Hono<AppEnv>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, service: "invoice-builder", time: new Date().toISOString() }));

// Which sign-in buttons the client should show.
app.get("/auth-config", (c) => c.json({ providers: configuredProviders(c.env) }));

app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

/** Rejects requests without a valid session; exposes the user as c.var.user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});

app.get("/me", requireUser, (c) => {
  const { id, name, email, image } = c.var.user;
  return c.json({ id, name, email, image });
});

app.use("/profile/*", requireUser);
app.use("/invoices/*", requireUser);
app.route("/profile", profileRoutes);
app.route("/invoices", invoiceRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
