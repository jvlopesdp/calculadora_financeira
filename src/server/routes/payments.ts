/**
 * Legacy shim — operates on the deprecated `payment_history` table (paired
 * with the deprecated `financing_scenarios`; kept around for rollback after
 * the US-006 unification). The canonical "Meus Financiamentos" payments
 * live in `tracker-entries.ts` under `/api/tracker/plans/:planId/entries`.
 * These routes only exist so the old Histórico pages keep working during
 * the transition and will be removed in US-020.
 */
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";

type PaymentsContext = Context<{
  Bindings: Env;
  Variables: AuthVariables;
}>;

/**
 * Row shape for the `payment_history` table (snake_case, integer cents,
 * epoch-ms `created_at`).
 */
export interface PaymentRow {
  id: string;
  scenario_id: string;
  reference_month: string;
  payment_date: string;
  amount_paid_cents: number;
  payment_type: string;
  amortization_strategy: string;
  notes: string | null;
  created_at: number;
}

const REFERENCE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PAYMENT_TYPES = ["parcela", "amortizacao_extra", "misto"] as const;
const AMORTIZATION_STRATEGIES = ["prazo", "parcela"] as const;

const createPaymentSchema = z.object({
  referenceMonth: z
    .string()
    .regex(
      REFERENCE_MONTH_RE,
      "Mês de referência deve estar no formato AAAA-MM.",
    ),
  paymentDate: z
    .string()
    .regex(ISO_DATE_RE, "Data do pagamento deve estar no formato AAAA-MM-DD."),
  amountPaid: z
    .number({ message: "Valor pago deve ser numérico." })
    .finite("Valor pago deve ser finito.")
    .positive("Valor pago deve ser maior que zero."),
  paymentType: z.enum(PAYMENT_TYPES, {
    message:
      "Tipo de pagamento deve ser 'parcela', 'amortizacao_extra' ou 'misto'.",
  }),
  amortizationStrategy: z.enum(AMORTIZATION_STRATEGIES, {
    message: "Estratégia de amortização deve ser 'prazo' ou 'parcela'.",
  }),
  notes: z.string().max(1000).optional(),
});

const patchPaymentSchema = z
  .object({
    referenceMonth: z
      .string()
      .regex(
        REFERENCE_MONTH_RE,
        "Mês de referência deve estar no formato AAAA-MM.",
      )
      .optional(),
    paymentDate: z
      .string()
      .regex(
        ISO_DATE_RE,
        "Data do pagamento deve estar no formato AAAA-MM-DD.",
      )
      .optional(),
    amountPaid: z
      .number()
      .finite("Valor pago deve ser finito.")
      .positive("Valor pago deve ser maior que zero.")
      .optional(),
    paymentType: z.enum(PAYMENT_TYPES).optional(),
    amortizationStrategy: z.enum(AMORTIZATION_STRATEGIES).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.referenceMonth !== undefined ||
      v.paymentDate !== undefined ||
      v.amountPaid !== undefined ||
      v.paymentType !== undefined ||
      v.amortizationStrategy !== undefined ||
      v.notes !== undefined,
    { message: "Informe ao menos um campo para atualizar." },
  );

const toCents = (brl: number): number => Math.round(brl * 100);

const paymentsRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

paymentsRouter.use("*", requireUser);

/**
 * Resolves the parent scenario id from the route param and verifies that it
 * belongs to the current user. Returns `null` when missing or not owned —
 * caller should respond with 404.
 */
async function ownedScenarioId(c: PaymentsContext): Promise<string | null> {
  const user = c.get("user");
  const scenarioId = c.req.param("scenarioId");
  if (!scenarioId) return null;

  const row = await c.env.DB.prepare(
    `select "id" from "financing_scenarios" where "id" = ? and "user_id" = ?`,
  )
    .bind(scenarioId, user.id)
    .first<{ id: string }>();

  return row?.id ?? null;
}

paymentsRouter.post("/", async (c) => {
  const scenarioId = await ownedScenarioId(c);
  if (!scenarioId) {
    return c.json({ error: "not_found" } as const, 404);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = createPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      400,
    );
  }

  const {
    referenceMonth,
    paymentDate,
    amountPaid,
    paymentType,
    amortizationStrategy,
    notes,
  } = parsed.data;

  const row: PaymentRow = {
    id: crypto.randomUUID(),
    scenario_id: scenarioId,
    reference_month: referenceMonth,
    payment_date: paymentDate,
    amount_paid_cents: toCents(amountPaid),
    payment_type: paymentType,
    amortization_strategy: amortizationStrategy,
    notes: notes ?? null,
    created_at: Date.now(),
  };

  await c.env.DB.prepare(
    `insert into "payment_history" ("id","scenario_id","reference_month","payment_date","amount_paid_cents","payment_type","amortization_strategy","notes","created_at") values (?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      row.id,
      row.scenario_id,
      row.reference_month,
      row.payment_date,
      row.amount_paid_cents,
      row.payment_type,
      row.amortization_strategy,
      row.notes,
      row.created_at,
    )
    .run();

  return c.json({ payment: row } as const, 201);
});

paymentsRouter.get("/", async (c) => {
  const scenarioId = await ownedScenarioId(c);
  if (!scenarioId) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const { results } = await c.env.DB.prepare(
    `select * from "payment_history" where "scenario_id" = ? order by "reference_month" asc`,
  )
    .bind(scenarioId)
    .all<PaymentRow>();

  return c.json({ payments: results ?? [] });
});

paymentsRouter.patch("/:pid", async (c) => {
  const scenarioId = await ownedScenarioId(c);
  if (!scenarioId) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const pid = c.req.param("pid");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = patchPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      400,
    );
  }

  const existing = await c.env.DB.prepare(
    `select * from "payment_history" where "id" = ? and "scenario_id" = ?`,
  )
    .bind(pid, scenarioId)
    .first<PaymentRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const {
    referenceMonth,
    paymentDate,
    amountPaid,
    paymentType,
    amortizationStrategy,
    notes,
  } = parsed.data;

  if (referenceMonth !== undefined) {
    await c.env.DB.prepare(
      `update "payment_history" set "reference_month" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(referenceMonth, pid, scenarioId)
      .run();
    existing.reference_month = referenceMonth;
  }

  if (paymentDate !== undefined) {
    await c.env.DB.prepare(
      `update "payment_history" set "payment_date" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(paymentDate, pid, scenarioId)
      .run();
    existing.payment_date = paymentDate;
  }

  if (amountPaid !== undefined) {
    const cents = toCents(amountPaid);
    await c.env.DB.prepare(
      `update "payment_history" set "amount_paid_cents" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(cents, pid, scenarioId)
      .run();
    existing.amount_paid_cents = cents;
  }

  if (paymentType !== undefined) {
    await c.env.DB.prepare(
      `update "payment_history" set "payment_type" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(paymentType, pid, scenarioId)
      .run();
    existing.payment_type = paymentType;
  }

  if (amortizationStrategy !== undefined) {
    await c.env.DB.prepare(
      `update "payment_history" set "amortization_strategy" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(amortizationStrategy, pid, scenarioId)
      .run();
    existing.amortization_strategy = amortizationStrategy;
  }

  if (notes !== undefined) {
    await c.env.DB.prepare(
      `update "payment_history" set "notes" = ? where "id" = ? and "scenario_id" = ?`,
    )
      .bind(notes, pid, scenarioId)
      .run();
    existing.notes = notes;
  }

  return c.json({ payment: existing });
});

paymentsRouter.delete("/:pid", async (c) => {
  const scenarioId = await ownedScenarioId(c);
  if (!scenarioId) {
    return c.json({ error: "not_found" } as const, 404);
  }

  const pid = c.req.param("pid");

  const existing = await c.env.DB.prepare(
    `select * from "payment_history" where "id" = ? and "scenario_id" = ?`,
  )
    .bind(pid, scenarioId)
    .first<PaymentRow>();

  if (!existing) {
    return c.json({ error: "not_found" } as const, 404);
  }

  await c.env.DB.prepare(
    `delete from "payment_history" where "id" = ? and "scenario_id" = ?`,
  )
    .bind(pid, scenarioId)
    .run();

  return c.json({ payment: existing });
});

export default paymentsRouter;
