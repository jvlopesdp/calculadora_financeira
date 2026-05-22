import { Hono } from "hono";

import { createAuth } from "./auth";
import type { Env } from "./env";
import { requireUser, type AuthVariables } from "./middleware/require-user";
import scenariosRouter from "./routes/scenarios";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    environment: c.env.ENVIRONMENT ?? "production",
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) =>
  createAuth(c.env).handler(c.req.raw),
);

// Sub-apps that bring their own `requireUser` middleware are mounted here.
// They must register BEFORE the generic `app.use("/api/*", requireUser)` below
// so the parent middleware does not double-run on every request.
app.route("/api/scenarios", scenariosRouter);

// Every /api/* route registered below this line requires a valid session.
app.use("/api/*", requireUser);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

app.all("*", async (c) => {
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  const indexUrl = new URL("/index.html", c.req.url);
  return c.env.ASSETS.fetch(new Request(indexUrl.toString(), c.req.raw));
});

export default app;
