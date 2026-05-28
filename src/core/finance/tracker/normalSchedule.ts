import type Decimal from "decimal.js";

import { generatePriceSchedule, generateSacSchedule } from "../amortization";
import type { AmortizationSystem } from "../financial-types";

export interface TrackerPlanInput {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
  modality: AmortizationSystem;
}

export interface ScheduleMonth {
  monthIndex: number;
  installment: Decimal;
  interest: Decimal;
  amortization: Decimal;
  balance: Decimal;
}

/**
 * Cronograma "sem antecipação" de um plano de acompanhamento. Delega às
 * primitivas PRICE/SAC existentes (nada de fórmula duplicada). Espera os
 * valores já convertidos: `principal` em BRL e `monthlyRate` como fração — a
 * conversão cents→BRL e bp→fração é responsabilidade do caller.
 */
export function normalSchedule(plan: TrackerPlanInput): ScheduleMonth[] {
  const inputs = {
    principal: plan.principal,
    monthlyRate: plan.monthlyRate,
    termMonths: plan.termMonths,
  };

  const rows =
    plan.modality === "SAC"
      ? generateSacSchedule(inputs)
      : generatePriceSchedule(inputs);

  return rows.map((row) => ({
    monthIndex: row.month,
    installment: row.installment,
    interest: row.interest,
    amortization: row.amortization,
    balance: row.balance,
  }));
}
