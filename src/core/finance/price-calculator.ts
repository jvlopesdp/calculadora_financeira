import Decimal from "decimal.js";
import "./financial-types";

export interface PriceInstallmentInputs {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
}

export function calculatePriceInstallment({
  principal,
  monthlyRate,
  termMonths,
}: PriceInstallmentInputs): Decimal {
  if (termMonths <= 0) {
    throw new Error("termMonths must be greater than zero");
  }
  if (principal.isNegative()) {
    throw new Error("principal must be non-negative");
  }
  if (monthlyRate.isNegative()) {
    throw new Error("monthlyRate must be non-negative");
  }

  if (monthlyRate.isZero()) {
    return principal.div(termMonths);
  }

  const onePlusRate = monthlyRate.plus(1);
  const compoundFactor = onePlusRate.pow(termMonths);
  const numerator = principal.times(monthlyRate).times(compoundFactor);
  const denominator = compoundFactor.minus(1);
  return numerator.div(denominator);
}
