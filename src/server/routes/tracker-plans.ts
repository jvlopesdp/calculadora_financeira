/**
 * "Meus Financiamentos" router. Backed by the `tracker_plans` table — the
 * single source of truth for a user's financings. Pair with
 * `tracker-entries.ts` (the nested entries CRUD).
 */
import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";

/**
 * Row shape for the `tracker_plans` table (snake_case, integer cents, basis
 * points for the rate, epoch-ms timestamps). One row per financing plan the
 * user is tracking under "Meus Financiamentos".
 */
export interface TrackerPlanRow {
  id: string;
  user_id: string;
  name: string;
  property_value_cents: number;
  down_payment_cents: number;
  term_months: number;
  annual_rate_bp: number;
  modality: "PRICE" | "SAC";
  start_date: string;
  target_monthly_total_cents: number;
  created_at: number;
  updated_at: number;
}

/**
 * Row shape for the `tracker_entries` table. Returned alongside a plan from
 * GET /:id; the entries CRUD lives in tracker-entries.ts (US-011).
 */
export interface TrackerEntryRow {
  id: string;
  plan_id: string;
  month_index: number;
  paid_amount_cents: number;
  paid_at: string;
  apply_mode: "reduce_term" | "reduce_installment";
  note: string | null;
  created_at: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  propertyValue: z.number().finite().positive(),
  downPayment: z.number().finite().nonnegative(),
  termMonths: z.number().int().positive(),
  annualRate: z.number().finite().positive(),
  modality: z.enum(["PRICE", "SAC"]),
  startDate: z.string().regex(ISO_DATE_RE, "expected YYYY-MM-DD"),
  targetMonthlyTotal: z.number().finite().positive(),
});

const updatePlanSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    targetMonthlyTotal: z.number().finite().positive().optional(),
  })
  .refine((v) => v.name !== undefined || v.targetMonthlyTotal !== undefined, {
    message: "at_least_one_field_required",
  });

const toCents = (brl: number): number => Math.round(brl * 100);
const toBasisPoints = (pct: number): number => Math.round(pct * 100);

const trackerPlansRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

trackerPlansRouter.use("*", requireUser);

trackerPlansRouter.post("/", async (c) => {
  const user = c.get("user");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = createPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const {
    name,
    propertyValue,
    downPayment,
    termMonths,
    annualRate,
    modality,
    startDate,
    targetMonthlyTotal,
  } = parsed.data;

  if (downPayment >= propertyValue) {
    return c.json(
      {
        error: "validation",
        message: "down_payment_must_be_less_than_property_value",
      } as const,
      422,
    );
  }

  const now = Date.now();
  const row: TrackerPlanRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    property_value_cents: toCents(propertyValue),
    down_payment_cents: toCents(downPayment),
    term_months: termMonths,
    annual_rate_bp: toBasisPoints(annualRate),
    modality,
    start_date: startDate,
    target_monthly_total_cents: toCents(targetMonthlyTotal),
    created_at: now,
    updated_at: now,
  };

  await c.env.DB.prepare(
    `insert into "tracker_plans" ("id","user_id","name","property_value_cents","down_payment_cents","term_months","annual_rate_bp","modality","start_date","target_monthly_total_cents","created_at","updated_at") values (?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      row.id,
      row.user_id,
      row.name,
      row.property_value_cents,
      row.down_payment_cents,
      row.term_months,
      row.annual_rate_bp,
      row.modality,
      row.start_date,
      row.target_monthly_total_cents,
      row.created_at,
      row.updated_at,
    )
    .run();

  return c.json({ plan: row } as const, 201);
});

trackerPlansRouter.get("/", async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    `select * from "tracker_plans" where "user_id" = ? order by "created_at" desc`,
  )
    .bind(user.id)
    .all<TrackerPlanRow>();

  return c.json({ plans: results ?? [] });
});

trackerPlansRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const plan = await c.env.DB.prepare(
    `select * from "tracker_plans" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<TrackerPlanRow>();

  if (!plan) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { results } = await c.env.DB.prepare(
    `select * from "tracker_entries" where "plan_id" = ? order by "month_index" asc`,
  )
    .bind(id)
    .all<TrackerEntryRow>();

  return c.json({ plan, entries: results ?? [] });
});

trackerPlansRouter.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = updatePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const existing = await c.env.DB.prepare(
    `select * from "tracker_plans" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<TrackerPlanRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { name, targetMonthlyTotal } = parsed.data;
  const updatedAt = Date.now();

  if (name !== undefined) {
    await c.env.DB.prepare(
      `update "tracker_plans" set "name" = ?, "updated_at" = ? where "id" = ? and "user_id" = ?`,
    )
      .bind(name, updatedAt, id, user.id)
      .run();
    existing.name = name;
  }

  if (targetMonthlyTotal !== undefined) {
    const cents = toCents(targetMonthlyTotal);
    await c.env.DB.prepare(
      `update "tracker_plans" set "target_monthly_total_cents" = ?, "updated_at" = ? where "id" = ? and "user_id" = ?`,
    )
      .bind(cents, updatedAt, id, user.id)
      .run();
    existing.target_monthly_total_cents = cents;
  }

  existing.updated_at = updatedAt;

  return c.json({ plan: existing });
});

trackerPlansRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    `select * from "tracker_plans" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .first<TrackerPlanRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  // tracker_entries are removed by the ON DELETE CASCADE foreign key.
  await c.env.DB.prepare(
    `delete from "tracker_plans" where "id" = ? and "user_id" = ?`,
  )
    .bind(id, user.id)
    .run();

  return c.json({ plan: existing });
});

export default trackerPlansRouter;
