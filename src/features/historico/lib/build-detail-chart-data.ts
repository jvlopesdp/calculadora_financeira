import Decimal from "decimal.js";

import type { ScheduleRow } from "@/core/finance/financial-types";
import type { PrepaymentScheduleRow } from "@/core/finance/prepayment";
import type { CurrentState } from "@/core/finance/replay-payments";

export interface ScenarioBalanceChartPoint {
  month: number;
  saldoPrevisto: number;
  saldoReal: number;
}

export interface ScenarioInterestChartPoint {
  month: number;
  jurosPrevisto: number;
  jurosReal: number;
}

const ZERO = new Decimal(0);

/**
 * Build the per-month outstanding balance series for both the baseline schedule
 * (no extra payments) and the real schedule (history + remaining projection).
 * Month 0 is the initial principal for both lines so the chart starts flush.
 */
export function prepareScenarioBalanceData(
  principal: Decimal,
  state: CurrentState,
): ScenarioBalanceChartPoint[] {
  const principalNumber = principal.toNumber();

  const baselineByMonth = new Map<number, number>();
  baselineByMonth.set(0, principalNumber);
  for (const row of state.baselineSchedule) {
    baselineByMonth.set(row.month, row.balance.toNumber());
  }

  const realByMonth = new Map<number, number>();
  realByMonth.set(0, principalNumber);
  for (const row of state.historicalSchedule) {
    realByMonth.set(row.month, row.balance.toNumber());
  }
  for (const row of state.remainingSchedule) {
    realByMonth.set(row.month, row.balance.toNumber());
  }

  const maxMonth = Math.max(
    state.baselineSchedule.length,
    state.remainingSchedule.length > 0
      ? state.remainingSchedule[state.remainingSchedule.length - 1]!.month
      : state.historicalSchedule.length > 0
        ? state.historicalSchedule[state.historicalSchedule.length - 1]!.month
        : 0,
  );

  let lastBaseline = principalNumber;
  let lastReal = principalNumber;
  const points: ScenarioBalanceChartPoint[] = [];
  for (let month = 0; month <= maxMonth; month++) {
    const saldoPrevisto = baselineByMonth.get(month) ?? lastBaseline;
    const saldoReal = realByMonth.get(month) ?? lastReal;
    lastBaseline = saldoPrevisto;
    lastReal = saldoReal;
    points.push({ month, saldoPrevisto, saldoReal });
  }
  return points;
}

/**
 * Build the per-month cumulative interest series for the baseline schedule vs
 * the real schedule. Month 0 is zero for both lines.
 */
export function prepareScenarioInterestData(
  state: CurrentState,
): ScenarioInterestChartPoint[] {
  const baselineCumByMonth = cumulativeInterest(state.baselineSchedule);
  const realRows: PrepaymentScheduleRow[] = [
    ...state.historicalSchedule,
    ...state.remainingSchedule,
  ];
  const realCumByMonth = cumulativeInterest(realRows);

  const maxMonth = Math.max(
    state.baselineSchedule.length,
    realRows.length === 0 ? 0 : realRows[realRows.length - 1]!.month,
  );

  let lastBaseline = 0;
  let lastReal = 0;
  const points: ScenarioInterestChartPoint[] = [];
  for (let month = 0; month <= maxMonth; month++) {
    const jurosPrevisto = baselineCumByMonth.get(month) ?? lastBaseline;
    const jurosReal = realCumByMonth.get(month) ?? lastReal;
    lastBaseline = jurosPrevisto;
    lastReal = jurosReal;
    points.push({ month, jurosPrevisto, jurosReal });
  }
  return points;
}

function cumulativeInterest(
  rows: ReadonlyArray<ScheduleRow | PrepaymentScheduleRow>,
): Map<number, number> {
  const byMonth = new Map<number, number>();
  byMonth.set(0, 0);
  let acc = ZERO;
  for (const row of rows) {
    acc = acc.plus(row.interest);
    byMonth.set(row.month, acc.toNumber());
  }
  return byMonth;
}

export interface ScenarioSavingsSummary {
  interestSaved: number;
  monthsReduced: number;
  baselineTotalInterest: number;
  realTotalInterest: number;
  baselineTermMonths: number;
  realTermMonths: number;
}

/**
 * Compare baseline (no extras) totals vs the real + projected totals to
 * derive savings: lifetime interest avoided and term reduction.
 */
export function summarizeScenarioSavings(
  state: CurrentState,
): ScenarioSavingsSummary {
  const baselineTotalInterest = state.baselineSchedule
    .reduce((acc, row) => acc.plus(row.interest), ZERO)
    .toNumber();
  const realTotalInterest = state.paidInterest
    .plus(
      state.remainingSchedule.reduce(
        (acc, row) => acc.plus(row.interest),
        ZERO,
      ),
    )
    .toNumber();

  const baselineTermMonths = state.baselineSchedule.length;
  const realTermMonths =
    state.historicalSchedule.length + state.remainingSchedule.length;

  return {
    interestSaved: baselineTotalInterest - realTotalInterest,
    monthsReduced: Math.max(0, baselineTermMonths - realTermMonths),
    baselineTotalInterest,
    realTotalInterest,
    baselineTermMonths,
    realTermMonths,
  };
}
