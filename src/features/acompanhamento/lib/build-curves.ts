import Decimal from "decimal.js";

import { annualToMonthlyRate } from "@/core/finance/rent-vs-buy";
import { goalSchedule, type GoalResult } from "@/core/finance/tracker/goalSchedule";
import {
  normalSchedule,
  type ScheduleMonth,
  type TrackerPlanInput,
} from "@/core/finance/tracker/normalSchedule";
import {
  realizedSchedule,
  type RealizedEntry,
  type RealizedResult,
} from "@/core/finance/tracker/realizedSchedule";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

/**
 * Resultado das três curvas de um plano de acompanhamento, já computadas.
 * `entriesByMonth` é exposto para reuso pelas stories de planilha/simulação.
 */
export interface TrackerCurves {
  planInput: TrackerPlanInput;
  normal: ScheduleMonth[];
  realized: RealizedResult;
  goal: GoalResult;
  targetMonthlyTotal: Decimal;
  entriesByMonth: Map<number, RealizedEntry>;
  hasEntries: boolean;
  /** Maior `month_index` com lançamento; null quando não há lançamentos. */
  lastEntryMonth: number | null;
}

/**
 * Chokepoint único que converte a row do plano (cents→BRL, bp→fração) e seus
 * lançamentos para os inputs dos engines puros, então computa as três curvas
 * (Normal, Realizado, Meta). A conversão de unidades vive aqui — os engines em
 * `core/finance/tracker` permanecem unit-agnostic.
 */
export function buildCurves(
  plan: TrackerPlanApi,
  entries: TrackerEntryApi[],
): TrackerCurves {
  const principal = new Decimal(
    plan.property_value_cents - plan.down_payment_cents,
  ).div(100);
  const monthlyRate = annualToMonthlyRate(
    new Decimal(plan.annual_rate_bp).div(10_000),
  );

  const planInput: TrackerPlanInput = {
    principal,
    monthlyRate,
    termMonths: plan.term_months,
    modality: plan.modality,
  };

  const entriesByMonth = new Map<number, RealizedEntry>();
  for (const entry of entries) {
    entriesByMonth.set(entry.month_index, {
      paidAmount: new Decimal(entry.paid_amount_cents).div(100),
      applyMode: entry.apply_mode,
    });
  }

  const targetMonthlyTotal = new Decimal(
    plan.target_monthly_total_cents,
  ).div(100);

  const lastEntryMonth =
    entries.length > 0
      ? Math.max(...entries.map((entry) => entry.month_index))
      : null;

  return {
    planInput,
    normal: normalSchedule(planInput),
    realized: realizedSchedule(planInput, entriesByMonth),
    goal: goalSchedule(planInput, targetMonthlyTotal),
    targetMonthlyTotal,
    entriesByMonth,
    hasEntries: entries.length > 0,
    lastEntryMonth,
  };
}
