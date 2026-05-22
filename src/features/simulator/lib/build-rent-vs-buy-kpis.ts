import Decimal from "decimal.js";
import {
  HomeIcon,
  KeyIcon,
  ScaleIcon,
  TrophyIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";
import {
  compareRentVsBuy,
  type RentVsBuyInputs,
} from "@/core/finance/rent-vs-buy";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";
import { formatBRL } from "@/lib/formatters/currency";

const EMPTY_VALUE = "—";

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

export interface RentVsBuyKpiInput {
  financing: FinancingFormValues | null;
  rentVsBuy: RentVsBuyFormValues | null;
}

export function buildRentVsBuyKpis({
  financing,
  rentVsBuy,
}: RentVsBuyKpiInput): KpiCardData[] {
  const empty: KpiCardData[] = [
    {
      title: "Patrimônio comprar",
      value: EMPTY_VALUE,
      icon: HomeIcon,
    },
    {
      title: "Patrimônio alugar",
      value: EMPTY_VALUE,
      icon: KeyIcon,
    },
    {
      title: "Diferença",
      value: EMPTY_VALUE,
      icon: ScaleIcon,
    },
    {
      title: "Vencedor",
      value: EMPTY_VALUE,
      icon: TrophyIcon,
    },
  ];

  if (!financing || !rentVsBuy) return empty;

  try {
    const result = compareRentVsBuy(buildEngineInputs(financing, rentVsBuy));
    const finalBuy =
      result.buyTimeline[result.buyTimeline.length - 1]?.netWorth ??
      new Decimal(0);
    const finalRent =
      result.rentTimeline[result.rentTimeline.length - 1]?.netWorth ??
      new Decimal(0);
    const diff = result.summary.netWorthDifferenceFinal;
    const best = result.summary.bestScenario;

    const winnerLabel =
      best === "buy" ? "Comprar" : best === "rent" ? "Alugar + investir" : "Empate";
    const winnerHint =
      best === "tie" ? "Resultados equivalentes" : `${formatBRL(diff.abs())} de vantagem`;

    return [
      {
        title: "Patrimônio comprar",
        value: formatBRL(finalBuy),
        icon: HomeIcon,
        trend: best === "buy" ? "up" : "neutral",
      },
      {
        title: "Patrimônio alugar",
        value: formatBRL(finalRent),
        icon: KeyIcon,
        trend: best === "rent" ? "up" : "neutral",
      },
      {
        title: "Diferença",
        value: formatBRL(diff),
        delta:
          best === "buy"
            ? "comprar ganha"
            : best === "rent"
              ? "alugar ganha"
              : "empate",
        trend: best === "buy" ? "up" : best === "rent" ? "down" : "neutral",
        icon: ScaleIcon,
      },
      {
        title: "Vencedor",
        value: winnerLabel,
        hint: winnerHint,
        icon: TrophyIcon,
      },
    ];
  } catch {
    return empty;
  }
}
