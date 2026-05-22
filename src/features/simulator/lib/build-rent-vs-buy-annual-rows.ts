import type Decimal from "decimal.js";

import { compareRentVsBuy } from "@/core/finance/rent-vs-buy";
import { buildRentVsBuyEngineInputs } from "@/features/simulator/lib/rent-vs-buy-engine";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

export interface RentVsBuyAnnualRow {
  year: number;
  month: number;
  comprar: Decimal;
  alugar: Decimal;
  diferenca: Decimal;
}

export function buildRentVsBuyAnnualRows(
  rentVsBuy: RentVsBuyFormValues | null,
): RentVsBuyAnnualRow[] {
  if (!rentVsBuy) return [];
  try {
    const result = compareRentVsBuy(buildRentVsBuyEngineInputs(rentVsBuy));
    const horizon = result.buyTimeline.length - 1;
    const months: number[] = [];
    for (let m = 12; m <= horizon; m += 12) months.push(m);
    if (months.length === 0 || months[months.length - 1] !== horizon) {
      months.push(horizon);
    }
    return months.map((m) => {
      const comprar = result.buyTimeline[m].netWorth;
      const alugar = result.rentTimeline[m].netWorth;
      return {
        year: Math.ceil(m / 12),
        month: m,
        comprar,
        alugar,
        diferenca: comprar.minus(alugar),
      };
    });
  } catch {
    return [];
  }
}
