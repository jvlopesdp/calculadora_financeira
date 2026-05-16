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

export const INTEREST_SAVINGS_CHART_EMPTY_STATE =
  "Informe um valor extra para visualizar a economia";

export interface InterestSavingsChartPoint {
  month: number;
  economiaAcumulada: number;
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

export function prepareInterestSavingsData(
  financing: FinancingFormValues | null,
  extraMonthly: number | null,
  strategy: ExtraPaymentStrategy,
): InterestSavingsChartPoint[] | null {
  if (!financing) return null;
  if (extraMonthly === null || extraMonthly <= 0) return null;
  try {
    const inputs = buildFinancingInputs(financing);
    const baseSchedule = baseScheduleFor(inputs);
    if (baseSchedule.length === 0) return null;
    const extra = new Decimal(extraMonthly);
    const extraSchedule = extraScheduleFor(inputs, strategy, extra);

    const baseInterestByMonth = new Map<number, number>();
    for (const row of baseSchedule) {
      baseInterestByMonth.set(row.month, row.interest.toNumber());
    }
    const extraInterestByMonth = new Map<number, number>();
    for (const row of extraSchedule) {
      extraInterestByMonth.set(row.month, row.interest.toNumber());
    }

    const maxMonth = Math.max(baseSchedule.length, extraSchedule.length);
    const points: InterestSavingsChartPoint[] = [];
    points.push({ month: 0, economiaAcumulada: 0 });
    let cumulative = 0;
    for (let month = 1; month <= maxMonth; month++) {
      const baseInterest = baseInterestByMonth.get(month) ?? 0;
      const extraInterest = extraInterestByMonth.get(month) ?? 0;
      cumulative += baseInterest - extraInterest;
      points.push({
        month,
        economiaAcumulada: cumulative,
      });
    }
    return points;
  } catch {
    return null;
  }
}
