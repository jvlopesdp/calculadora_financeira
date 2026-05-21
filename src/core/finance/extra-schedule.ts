import Decimal from "decimal.js";

import { type FinancingInputs, roundMoney } from "./financial-types";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentResult,
} from "./prepayment";
import { calculatePriceInstallment } from "./price-calculator";
import { resolveExtraFromTargetPayment } from "./target-payment";

export type ExtraSchedulePrepaymentStrategy = "term" | "installment";

/**
 * Resolve the prepayment schedule for a financing + monthly extra payment.
 *
 * For PRICE, routes through `resolveExtraFromTargetPayment` so the same engine
 * the UI uses for "parcela mensal desejada" produces the canonical schedule
 * downstream consumers (charts, Excel) plot. SAC falls back to the prepayment
 * engine directly because the target-payment helper is PRICE-only.
 */
export function resolveExtraSchedule(
  inputs: FinancingInputs,
  extra: Decimal,
  strategy: ExtraSchedulePrepaymentStrategy,
): PrepaymentResult {
  const { principal, monthlyRate, termMonths, system } = inputs;

  if (system === "SAC") {
    return strategy === "installment"
      ? applyPrepaymentReduceInstallment(inputs, extra)
      : applyPrepaymentReduceTerm(inputs, extra);
  }

  const basePriceInstallment = roundMoney(
    calculatePriceInstallment({ principal, monthlyRate, termMonths }),
  );
  const targetMonthlyPayment = roundMoney(basePriceInstallment.plus(extra));
  const result = resolveExtraFromTargetPayment({
    principal,
    monthlyRate,
    termMonths,
    targetMonthlyPayment,
    strategy: strategy === "installment" ? "reduce-installment" : "reduce-term",
  });
  return { schedule: result.schedule, summary: result.summary };
}
