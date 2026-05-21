import Decimal from "decimal.js";
import { formatBRL } from "../../lib/formatters/currency";
import { roundMoney } from "./financial-types";
import { calculatePriceInstallment } from "./price-calculator";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentScheduleRow,
  type PrepaymentSummary,
} from "./prepayment";

export type TargetPaymentStrategy = "reduce-term" | "reduce-installment";

export interface ResolveExtraFromTargetPaymentInputs {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
  targetMonthlyPayment: Decimal;
  strategy?: TargetPaymentStrategy;
}

export interface ResolveExtraFromTargetPaymentResult {
  extraPayment: Decimal;
  schedule: PrepaymentScheduleRow[];
  summary: PrepaymentSummary;
}

/**
 * Inverse of the extra-payment engine: given a target monthly payment ≥ the base
 * PRICE installment, compute the implied extra payment and run the amortization
 * under the chosen strategy. Reuses the MVP's reduce-term / reduce-installment
 * engines for the actual schedule generation.
 */
export function resolveExtraFromTargetPayment({
  principal,
  monthlyRate,
  termMonths,
  targetMonthlyPayment,
  strategy = "reduce-term",
}: ResolveExtraFromTargetPaymentInputs): ResolveExtraFromTargetPaymentResult {
  const baseInstallment = roundMoney(
    calculatePriceInstallment({ principal, monthlyRate, termMonths }),
  );
  const target = roundMoney(targetMonthlyPayment);

  if (target.lessThan(baseInstallment)) {
    throw new Error(
      `Parcela desejada deve ser ≥ ${formatBRL(baseInstallment)}`,
    );
  }

  const extraPayment = roundMoney(target.minus(baseInstallment));
  const inputs = {
    principal,
    monthlyRate,
    termMonths,
    system: "PRICE" as const,
  };

  const { schedule, summary } =
    strategy === "reduce-installment"
      ? applyPrepaymentReduceInstallment(inputs, extraPayment)
      : applyPrepaymentReduceTerm(inputs, extraPayment);

  return { extraPayment, schedule, summary };
}
