import Decimal from "decimal.js";

import {
  annualToMonthlyRate,
  type RentVsBuyInputs,
} from "@/core/finance/rent-vs-buy";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

/**
 * Build engine-shaped inputs for `compareRentVsBuy` from the rent-vs-buy form
 * alone. The /alugar-x-financiar page is independent of /financiamento, so the
 * financing rate (annual) is converted to its monthly equivalent here and the
 * amortization system defaults to PRICE.
 */
export function buildRentVsBuyEngineInputs(
  values: RentVsBuyFormValues,
): RentVsBuyInputs {
  const annualRate = new Decimal(values.annualRate).div(100);
  const monthlyRate = annualToMonthlyRate(annualRate);
  return {
    propertyValue: new Decimal(values.propertyValue),
    downPayment: new Decimal(values.downPayment),
    monthlyRate,
    termMonths: values.termMonths,
    system: "PRICE",
    monthlyRent: new Decimal(values.monthlyRent),
    annualRentAdjustment: new Decimal(values.annualRentAdjustment).div(100),
    annualInvestmentReturn: new Decimal(values.annualInvestmentReturn).div(100),
    annualAppreciation: new Decimal(values.annualAppreciation).div(100),
    monthlyOwnershipCosts: new Decimal(values.monthlyOwnershipCosts),
    horizonMonths: values.horizonMonths,
  };
}
