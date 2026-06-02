import Decimal from "decimal.js";

import {
  realizedSchedule,
  type ApplyMode,
  type RealizedEntry,
} from "@/core/finance/tracker/realizedSchedule";
import type { ScheduleMonth } from "@/core/finance/tracker/normalSchedule";

import type { TrackerCurves } from "./build-curves";

export interface WhatIfInput {
  month: number;
  /** Valor total pago no mês simulado, em BRL. */
  paidAmount: Decimal;
  applyMode: ApplyMode;
}

export interface WhatIfResult {
  /** Mês em que o saldo zera no cenário simulado. */
  payoffMonth: number;
  /** Meses adiantados em relação ao prazo Normal (>= 0). */
  monthsSavedVsNormal: number;
  /** Juros economizados em relação à trajetória atual (Realizado), em BRL. */
  interestSaved: Decimal;
  /** Parcelas economizadas em relação à trajetória atual (Realizado). */
  installmentsSaved: number;
}

const ZERO = new Decimal(0);

function totalInterest(months: ScheduleMonth[]): Decimal {
  return months.reduce((acc, month) => acc.plus(month.interest), ZERO);
}

/**
 * Simulação "e se?" não-persistente: aplica um lançamento hipotético por cima
 * dos lançamentos reais (em memória, sem tocar na API) e mede o impacto em
 * relação à trajetória atual (Realizado) e ao prazo Normal. Reusa o engine
 * `realizedSchedule` — nenhuma fórmula nova aqui.
 */
export function simulateWhatIf(
  curves: TrackerCurves,
  input: WhatIfInput,
): WhatIfResult {
  const entries = new Map<number, RealizedEntry>(curves.entriesByMonth);
  entries.set(input.month, {
    paidAmount: input.paidAmount,
    applyMode: input.applyMode,
  });

  const simulated = realizedSchedule(curves.planInput, entries);
  const payoffMonth = simulated.paidOffAtMonth ?? simulated.months.length;

  return {
    payoffMonth,
    monthsSavedVsNormal: curves.normal.length - payoffMonth,
    interestSaved: totalInterest(curves.realized.months).minus(
      totalInterest(simulated.months),
    ),
    installmentsSaved: curves.realized.months.length - simulated.months.length,
  };
}
