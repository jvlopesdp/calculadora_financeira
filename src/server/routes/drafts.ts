/**
 * Simulator draft router (`/api/drafts`). The draft is an opaque JSON blob
 * persisted in `scenario_drafts` so an authenticated user can resume an
 * unfinished simulator session across devices. One row per user — the table
 * uses `user_id` as the primary key and the handlers upsert by it.
 */
import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";

// The draft payload is opaque to the server: we only require it to be a JSON
// object and persist it verbatim. The simulator owns its shape.
const draftPayloadSchema = z.record(z.unknown());

const draftsRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

draftsRouter.use("*", requireUser);

draftsRouter.get("/", async (c) => {
  const user = c.get("user");

  const row = await c.env.DB.prepare(
    `select "payload" from "scenario_drafts" where "user_id" = ?`,
  )
    .bind(user.id)
    .first<{ payload: string }>();

  if (!row) {
    return c.json({ draft: null } as const);
  }

  let draft: unknown = null;
  try {
    draft = JSON.parse(row.payload);
  } catch {
    draft = null;
  }

  return c.json({ draft });
});

draftsRouter.put("/", async (c) => {
  const user = c.get("user");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = draftPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      400,
    );
  }

  const updatedAt = Date.now();

  await c.env.DB.prepare(
    `insert into "scenario_drafts" ("user_id","payload","updated_at") values (?,?,?) on conflict("user_id") do update set "payload" = excluded."payload", "updated_at" = excluded."updated_at"`,
  )
    .bind(user.id, JSON.stringify(parsed.data), updatedAt)
    .run();

  return c.json({ draft: parsed.data, updated_at: updatedAt });
});

export default draftsRouter;
