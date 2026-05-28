import { Hono, type Context } from "hono";
import Decimal from "decimal.js";
import { z } from "zod";

import { generatePriceSchedule, generateSacSchedule } from "@/core/finance/amortization";
import { annualToMonthlyRate } from "@/core/finance/rent-vs-buy";
import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";
import type { TrackerEntryRow, TrackerPlanRow } from "./tracker-plans";

type EntriesContext = Context<{
  Bindings: Env;
  Variables: AuthVariables;
}>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const APPLY_MODES = ["reduce_term", "reduce_installment"] as const;

const createEntrySchema = z.object({
  month_index: z.number().int().positive(),
  paid_amount: z.number().finite().positive(),
  paid_at: z.string().regex(ISO_DATE_RE, "expected YYYY-MM-DD"),
  apply_mode: z.enum(APPLY_MODES),
  note: z.string().max(1000).optional(),
});

const patchEntrySchema = z
  .object({
    paid_amount: z.number().finite().positive().optional(),
    apply_mode: z.enum(APPLY_MODES).optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.paid_amount !== undefined ||
      v.apply_mode !== undefined ||
      v.note !== undefined,
    { message: "at_least_one_field_required" },
  );

const toCents = (brl: number): number => Math.round(brl * 100);

/**
 * Installment (in cents) the plan owes in `monthIndex` under the *normal*
 * schedule — i.e. with no prepayments. This is the minimum a real entry may
 * pay. Reuses the existing PRICE/SAC engine (US-012 will formalise this as
 * `normalSchedule`). `monthIndex` must be within 1..term_months.
 */
function installmentCentsForMonth(
  plan: TrackerPlanRow,
  monthIndex: number,
): number {
  const principal = new Decimal(
    plan.property_value_cents - plan.down_payment_cents,
  ).div(100);
  const annualRateFraction = new Decimal(plan.annual_rate_bp).div(10_000);
  const monthlyRate = annualToMonthlyRate(annualRateFraction);
  const inputs = {
    principal,
    monthlyRate,
    termMonths: plan.term_months,
  };
  const schedule =
    plan.modality === "SAC"
      ? generateSacSchedule(inputs)
      : generatePriceSchedule(inputs);
  return Math.round(schedule[monthIndex - 1].installment.times(100).toNumber());
}

function formatCentsBRL(cents: number): string {
  return (cents / 100).toFixed(2);
}

const trackerEntriesRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

trackerEntriesRouter.use("*", requireUser);

/**
 * Resolves the parent plan from the route param and verifies that it belongs to
 * the current user. Returns `null` when missing or not owned — caller responds
 * with 404. Returns the full row (not just the id) because the installment
 * validation needs the plan's modality, term and rate.
 */
async function ownedPlan(c: EntriesContext): Promise<TrackerPlanRow | null> {
  const user = c.get("user");
  const planId = c.req.param("planId");
  if (!planId) return null;

  const plan = await c.env.DB.prepare(
    `select * from "tracker_plans" where "id" = ? and "user_id" = ?`,
  )
    .bind(planId, user.id)
    .first<TrackerPlanRow>();

  return plan ?? null;
}

trackerEntriesRouter.post("/", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = createEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const plan = await ownedPlan(c);
  if (!plan) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { month_index, paid_amount, paid_at, apply_mode, note } = parsed.data;

  if (month_index > plan.term_months) {
    return c.json(
      {
        error: "validation",
        message: `O mês deve estar entre 1 e ${plan.term_months}.`,
      } as const,
      422,
    );
  }

  const paidAmountCents = toCents(paid_amount);
  const installmentCents = installmentCentsForMonth(plan, month_index);
  if (paidAmountCents < installmentCents) {
    return c.json(
      {
        error: "validation",
        message: `O valor pago não pode ser menor que a parcela prevista do mês ${month_index} (R$ ${formatCentsBRL(installmentCents)}).`,
      } as const,
      422,
    );
  }

  await c.env.DB.prepare(
    `insert into "tracker_entries" ("id","plan_id","month_index","paid_amount_cents","paid_at","apply_mode","note","created_at") values (?,?,?,?,?,?,?,?) on conflict ("plan_id","month_index") do update set "paid_amount_cents" = excluded."paid_amount_cents", "paid_at" = excluded."paid_at", "apply_mode" = excluded."apply_mode", "note" = excluded."note"`,
  )
    .bind(
      crypto.randomUUID(),
      plan.id,
      month_index,
      paidAmountCents,
      paid_at,
      apply_mode,
      note ?? null,
      Date.now(),
    )
    .run();

  const entry = await c.env.DB.prepare(
    `select * from "tracker_entries" where "plan_id" = ? and "month_index" = ?`,
  )
    .bind(plan.id, month_index)
    .first<TrackerEntryRow>();

  return c.json({ entry });
});

trackerEntriesRouter.patch("/:entryId", async (c) => {
  const plan = await ownedPlan(c);
  if (!plan) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const entryId = c.req.param("entryId");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = patchEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const existing = await c.env.DB.prepare(
    `select * from "tracker_entries" where "id" = ? and "plan_id" = ?`,
  )
    .bind(entryId, plan.id)
    .first<TrackerEntryRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { paid_amount, apply_mode, note } = parsed.data;

  if (paid_amount !== undefined) {
    const paidAmountCents = toCents(paid_amount);
    const installmentCents = installmentCentsForMonth(
      plan,
      existing.month_index,
    );
    if (paidAmountCents < installmentCents) {
      return c.json(
        {
          error: "validation",
          message: `O valor pago não pode ser menor que a parcela prevista do mês ${existing.month_index} (R$ ${formatCentsBRL(installmentCents)}).`,
        } as const,
        422,
      );
    }
    await c.env.DB.prepare(
      `update "tracker_entries" set "paid_amount_cents" = ? where "id" = ? and "plan_id" = ?`,
    )
      .bind(paidAmountCents, entryId, plan.id)
      .run();
    existing.paid_amount_cents = paidAmountCents;
  }

  if (apply_mode !== undefined) {
    await c.env.DB.prepare(
      `update "tracker_entries" set "apply_mode" = ? where "id" = ? and "plan_id" = ?`,
    )
      .bind(apply_mode, entryId, plan.id)
      .run();
    existing.apply_mode = apply_mode;
  }

  if (note !== undefined) {
    await c.env.DB.prepare(
      `update "tracker_entries" set "note" = ? where "id" = ? and "plan_id" = ?`,
    )
      .bind(note, entryId, plan.id)
      .run();
    existing.note = note;
  }

  return c.json({ entry: existing });
});

trackerEntriesRouter.delete("/:entryId", async (c) => {
  const plan = await ownedPlan(c);
  if (!plan) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const entryId = c.req.param("entryId");

  const existing = await c.env.DB.prepare(
    `select * from "tracker_entries" where "id" = ? and "plan_id" = ?`,
  )
    .bind(entryId, plan.id)
    .first<TrackerEntryRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  await c.env.DB.prepare(
    `delete from "tracker_entries" where "id" = ? and "plan_id" = ?`,
  )
    .bind(entryId, plan.id)
    .run();

  return c.json({ entry: existing });
});

export default trackerEntriesRouter;
