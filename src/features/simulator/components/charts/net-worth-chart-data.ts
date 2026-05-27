import { buildRentVsBuyEngineInputs } from "@/features/simulator/lib/rent-vs-buy-engine";
import { compareRentVsBuy } from "@/core/finance/rent-vs-buy";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

export const NET_WORTH_CHART_EMPTY_STATE =
  "Preencha os dados de aluguel vs. compra para visualizar a evolução do patrimônio.";

export interface NetWorthChartPoint {
  month: number;
  comprar: number;
  alugar: number;
  diferenca: number;
}

export function prepareNetWorthData(
  rentVsBuy: RentVsBuyFormValues | null,
): NetWorthChartPoint[] | null {
  if (!rentVsBuy) return null;
  try {
    const result = compareRentVsBuy(buildRentVsBuyEngineInputs(rentVsBuy));
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
