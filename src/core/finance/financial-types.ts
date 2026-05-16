import Decimal from "decimal.js";

Decimal.set({
  precision: 30,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export type AmortizationSystem = "PRICE" | "SAC";

export interface FinancingInputs {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
  system?: AmortizationSystem;
}

export interface ScheduleRow {
  month: number;
  installment: Decimal;
  interest: Decimal;
  amortization: Decimal;
  balance: Decimal;
}

export interface ScheduleSummary {
  totalPaid: Decimal;
  totalInterest: Decimal;
  totalAmortization: Decimal;
  termMonths: number;
}

export const MONEY_DECIMAL_PLACES = 2;
export const MONEY_ROUNDING = Decimal.ROUND_HALF_EVEN;

export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_DECIMAL_PLACES, MONEY_ROUNDING);
}

export function summarizeSchedule(
  schedule: ScheduleRow[],
  termMonths: number,
): ScheduleSummary {
  const zero = new Decimal(0);
  const totalPaid = schedule.reduce(
    (acc, row) => acc.plus(row.installment),
    zero,
  );
  const totalInterest = schedule.reduce(
    (acc, row) => acc.plus(row.interest),
    zero,
  );
  const totalAmortization = schedule.reduce(
    (acc, row) => acc.plus(row.amortization),
    zero,
  );
  return { totalPaid, totalInterest, totalAmortization, termMonths };
}
