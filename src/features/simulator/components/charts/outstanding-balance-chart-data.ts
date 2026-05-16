import Decimal from "decimal.js";

import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  type FinancingInputs,
  type ScheduleRow,
} from "@/core/finance/financial-types";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentScheduleRow,
} from "@/core/finance/prepayment";
import type { ExtraPaymentStrategy } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

export const OUTSTANDING_BALANCE_CHART_EMPTY_STATE =
  "Preencha os dados de financiamento para visualizar o saldo devedor.";

export interface OutstandingBalanceChartPoint {
  month: number;
  saldoBase: number;
  saldoExtra: number;
  diferenca: number;
}

function buildFinancingInputs(values: FinancingFormValues): FinancingInputs {
  return {
    principal: new Decimal(values.propertyValue).minus(values.downPayment),
    monthlyRate: new Decimal(values.monthlyRate).div(100),
    termMonths: values.termMonths,
    system: values.system,
  };
}

function baseScheduleFor(inputs: FinancingInputs): ScheduleRow[] {
  return inputs.system === "SAC"
    ? generateSacSchedule(inputs)
    : generatePriceSchedule(inputs);
}

function extraScheduleFor(
  inputs: FinancingInputs,
  strategy: ExtraPaymentStrategy,
  extra: Decimal,
): PrepaymentScheduleRow[] {
  return strategy === "term"
    ? applyPrepaymentReduceTerm(inputs, extra).schedule
    : applyPrepaymentReduceInstallment(inputs, extra).schedule;
}

export function prepareOutstandingBalanceData(
  financing: FinancingFormValues | null,
  extraMonthly: number | null,
  strategy: ExtraPaymentStrategy,
): OutstandingBalanceChartPoint[] | null {
  if (!financing) return null;
  try {
    const inputs = buildFinancingInputs(financing);
    const baseSchedule = baseScheduleFor(inputs);
    const extra = new Decimal(extraMonthly ?? 0);
    const extraSchedule = extraScheduleFor(inputs, strategy, extra);

    const principalNumber = inputs.principal.toNumber();
    const baseByMonth = new Map<number, number>();
    baseByMonth.set(0, principalNumber);
    for (const row of baseSchedule) {
      baseByMonth.set(row.month, row.balance.toNumber());
    }
    const extraByMonth = new Map<number, number>();
    extraByMonth.set(0, principalNumber);
    for (const row of extraSchedule) {
      extraByMonth.set(row.month, row.balance.toNumber());
    }

    const maxMonth = Math.max(baseSchedule.length, extraSchedule.length);
    const points: OutstandingBalanceChartPoint[] = [];
    for (let month = 0; month <= maxMonth; month++) {
      const saldoBase = baseByMonth.get(month) ?? 0;
      const saldoExtra = extraByMonth.get(month) ?? 0;
      points.push({
        month,
        saldoBase,
        saldoExtra,
        diferenca: saldoBase - saldoExtra,
      });
    }
    return points;
  } catch {
    return null;
  }
}
