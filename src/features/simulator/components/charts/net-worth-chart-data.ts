import Decimal from "decimal.js";

import {
  compareRentVsBuy,
  type RentVsBuyInputs,
} from "@/core/finance/rent-vs-buy";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

export const NET_WORTH_CHART_EMPTY_STATE =
  "Preencha os dados de financiamento e aluguel vs. compra para visualizar a evolução do patrimônio.";

export interface NetWorthChartPoint {
  month: number;
  comprar: number;
  alugar: number;
  diferenca: number;
}

function buildEngineInputs(
  financing: FinancingFormValues,
  values: RentVsBuyFormValues,
): RentVsBuyInputs {
  return {
    propertyValue: new Decimal(financing.propertyValue),
    downPayment: new Decimal(financing.downPayment),
    monthlyRate: new Decimal(financing.monthlyRate).div(100),
    termMonths: financing.termMonths,
    system: financing.system,
    monthlyRent: new Decimal(values.monthlyRent),
    annualRentAdjustment: new Decimal(values.annualRentAdjustment).div(100),
    annualInvestmentReturn: new Decimal(values.annualInvestmentReturn).div(100),
    annualAppreciation: new Decimal(values.annualAppreciation).div(100),
    monthlyOwnershipCosts: new Decimal(values.monthlyOwnershipCosts),
    horizonMonths: values.horizonMonths,
  };
}

export function prepareNetWorthData(
  financing: FinancingFormValues | null,
  rentVsBuy: RentVsBuyFormValues | null,
): NetWorthChartPoint[] | null {
  if (!financing || !rentVsBuy) return null;
  try {
    const result = compareRentVsBuy(buildEngineInputs(financing, rentVsBuy));
    return result.buyTimeline.map((buy, index) => {
      const rent = result.rentTimeline[index];
      const difference = buy.netWorth.minus(rent.netWorth);
      return {
        month: buy.month,
        comprar: buy.netWorth.toNumber(),
        alugar: rent.netWorth.toNumber(),
        diferenca: difference.toNumber(),
      };
    });
  } catch {
    return null;
  }
}
