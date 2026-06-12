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
  /**
   * Valor efetivamente desembolsado no mês. Em meses sem lançamento extra
   * (Normal) e em `realizedSchedule`/`goalSchedule` sem antecipação,
   * `installment === scheduledInstallment`.
   */
  installment: Decimal;
  /**
   * Parcela "prevista" (vigente) para o mês — o que seria pago sem extras.
   * Em `realizedSchedule`, é a parcela vigente no início do mês *antes* de
   * aplicar o lançamento; em meses subsequentes a um lançamento
   * `reduce_installment`, reflete o novo valor (reduzido) e por isso difere
   * da parcela do cronograma `normalSchedule`.
   */
  scheduledInstallment: Decimal;
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
    scheduledInstallment: row.installment,
    interest: row.interest,
    amortization: row.amortization,
    balance: row.balance,
  }));
}
