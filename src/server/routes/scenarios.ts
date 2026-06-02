import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";

/**
 * Row shape for the `financing_scenarios` table (snake_case, integer cents,
 * basis points for rates, epoch-ms timestamps).
 */
export interface ScenarioRow {
  id: string;
  user_id: string;
  name: string | null;
  property_value_cents: number;
  down_payment_cents: number;
  term_months: number;
  annual_rate_basis_points: number;
  start_date: string;
  created_at: number;
  archived_at: number | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const createScenarioSchema = z.object({
  name: z.string().min(1).max(100),
  propertyValue: z.number().finite().positive(),
  downPayment: z.number().finite().nonnegative(),
  termMonths: z.number().int().positive(),
  annualRate: z.number().finite().positive(),
  startDate: z.string().regex(ISO_DATE_RE, "expected YYYY-MM-DD"),
});

const patchScenarioSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.archived !== undefined, {
    message: "at_least_one_field_required",
  });

// The draft payload is opaque to the server: we only require it to be a JSON
// object and persist it verbatim. The simulator owns its shape.
const draftPayloadSchema = z.record(z.unknown());

const toCents = (brl: number): number => Math.round(brl * 100);
const toBasisPoints = (pct: number): number => Math.round(pct * 100);

const scenariosRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

scenariosRouter.use("*", requireUser);

// Registered before "/:id" so the static "/draft" path wins the match.
scenariosRouter.get("/draft", async (c) => {
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

scenariosRouter.put("/draft", async (c) => {
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

scenariosRouter.post("/", async (c) => {
  const user = c.get("user");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = createScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      400,
    );
  }

  const {
    name,
    propertyValue,
    downPayment,
    termMonths,
    annualRate,
    startDate,
  } = parsed.data;

  if (downPayment >= propertyValue) {
    return c.json(
      {
        error: "validation",
        message: "down_payment_must_be_less_than_property_value",
      } as const,
      400,
    );
  }

  const row: ScenarioRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    property_value_cents: toCents(propertyValue),
    down_payment_cents: toCents(downPayment),
    term_months: termMonths,
    annual_rate_basis_points: toBasisPoints(annualRate),
    start_date: startDate,
    created_at: Date.now(),
    archived_at: null,
  };

  await c.env.DB.prepare(
    `insert into "financing_scenarios" ("id","user_id","name","property_value_cents","down_payment_cents","term_months","annual_rate_basis_points","start_date","created_at","archived_at") values (?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      row.id,
      row.user_id,
      row.name,
      row.property_value_cents,
      row.down_payment_cents,
      row.term_months,
      row.annual_rate_basis_points,
      row.start_date,
      row.created_at,
      row.archived_at,
    )
    .run();

  return c.json({ scenario: row } as const, 201);
});

scenariosRouter.get("/", async (c) => {
  const user = c.get("user");
  const includeArchived = c.req.query("archived") === "true";

  const sql = includeArchived
    ? `select * from "financing_scenarios" where "user_id" = ? order by "created_at" desc`
    : `select * from "financing_scenarios" where "user_id" = ? and "archived_at" is null order by "created_at" desc`;

  const { results } = await c.env.DB.prepare(sql)
    .bind(user.id)
    .all<ScenarioRow>();

  return c.json({ scenarios: results ?? [] });
});

scenariosRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const row = await c.env.DB.prepare(
    `select * from "financing_scenarios" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<ScenarioRow>();

  if (!row) {
    return c.json({ error: "not_found" } as const, 404);
  }

  return c.json({ scenario: row });
});

scenariosRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = patchScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      400,
    );
  }

  const existing = await c.env.DB.prepare(
    `select * from "financing_scenarios" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<ScenarioRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { name, archived } = parsed.data;

  if (name !== undefined) {
    await c.env.DB.prepare(
      `update "financing_scenarios" set "name" = ? where "id" = ? and "user_id" = ?`,
    )
      .bind(name, id, user.id)
      .run();
    existing.name = name;
  }

  if (archived !== undefined) {
    const archivedAt = archived ? Date.now() : null;
    await c.env.DB.prepare(
      `update "financing_scenarios" set "archived_at" = ? where "id" = ? and "user_id" = ?`,
    )
      .bind(archivedAt, id, user.id)
      .run();
    existing.archived_at = archivedAt;
  }

  return c.json({ scenario: existing });
});

scenariosRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    `select * from "financing_scenarios" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<ScenarioRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const archivedAt = Date.now();
  await c.env.DB.prepare(
    `update "financing_scenarios" set "archived_at" = ? where "id" = ? and "user_id" = ?`,
  )
    .bind(archivedAt, id, user.id)
    .run();
  existing.archived_at = archivedAt;

  return c.json({ scenario: existing });
});

export default scenariosRouter;
