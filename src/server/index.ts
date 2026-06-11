import { Hono } from "hono";

import { createAuth } from "./auth";
import type { Env } from "./env";
import { requireUser, type AuthVariables } from "./middleware/require-user";
import accountRouter from "./routes/account";
import paymentsRouter from "./routes/payments";
import scenariosRouter from "./routes/scenarios";
import trackerEntriesRouter from "./routes/tracker-entries";
import trackerPlansRouter from "./routes/tracker-plans";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    version: __COMMIT_SHA__,
    environment: c.env.ENVIRONMENT ?? "production",
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const response = await createAuth(c.env).handler(c.req.raw);
  // Better Auth's built-in rate limiter sets `X-Retry-After` on 429 responses.
  // Mirror it to the standard `Retry-After` header so clients/CDNs see both.
  if (response.status === 429) {
    const xRetry = response.headers.get("X-Retry-After");
    if (xRetry && !response.headers.get("Retry-After")) {
      const headers = new Headers(response.headers);
      headers.set("Retry-After", xRetry);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }
  return response;
});

// Sub-apps that bring their own `requireUser` middleware are mounted here.
// They must register BEFORE the generic `app.use("/api/*", requireUser)` below
// so the parent middleware does not double-run on every request.
app.route("/api/scenarios/:scenarioId/payments", paymentsRouter);
app.route("/api/scenarios", scenariosRouter);
app.route("/api/tracker/plans/:planId/entries", trackerEntriesRouter);
app.route("/api/tracker/plans", trackerPlansRouter);
app.route("/api/account", accountRouter);

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

// Keep expired verification tokens for 30 days after expiry before purging,
// so a recently-expired token is still inspectable when debugging auth issues.
const VERIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Weekly cron (see `triggers.crons` in wrangler.jsonc): drops verification
 * tokens that expired more than {@link VERIFICATION_RETENTION_MS} ago so the
 * Better Auth `verification` table does not grow without bound.
 */
export async function scheduled(
  _event: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const cutoff = Date.now() - VERIFICATION_RETENTION_MS;
  const result = await env.DB.prepare(
    'delete from "verification" where "expiresAt" < ?',
  )
    .bind(cutoff)
    .run();
  console.log({
    event: "verification_cleanup",
    removed: result.meta.changes ?? 0,
  });
}

export { app };

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
