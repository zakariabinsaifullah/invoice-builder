import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, service: "invoice-builder", time: new Date().toISOString() }));

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
