import Decimal from "decimal.js";
import {
  type FinancingInputs,
  type ScheduleRow,
  roundMoney,
} from "./financial-types";
import { calculatePriceInstallment } from "./price-calculator";

export function generatePriceSchedule(
  inputs: FinancingInputs,
): ScheduleRow[] {
  const { principal, monthlyRate, termMonths } = inputs;

  if (termMonths <= 0) {
    return [];
  }

  const startingBalance = roundMoney(principal);
  const baseInstallment = roundMoney(
    calculatePriceInstallment({ principal, monthlyRate, termMonths }),
  );

  const rows: ScheduleRow[] = [];
  let balance = startingBalance;

  for (let month = 1; month <= termMonths; month++) {
    const interest = roundMoney(balance.times(monthlyRate));
    let installment: Decimal;
    let amortization: Decimal;

    if (month === termMonths) {
      amortization = balance;
      installment = roundMoney(amortization.plus(interest));
      balance = new Decimal(0);
    } else {
      installment = baseInstallment;
      amortization = installment.minus(interest);
      balance = balance.minus(amortization);
    }

    rows.push({
      month,
      installment,
      interest,
      amortization,
      balance,
    });
  }

  return rows;
}
