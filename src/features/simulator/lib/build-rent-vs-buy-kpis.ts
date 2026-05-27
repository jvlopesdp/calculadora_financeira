import Decimal from "decimal.js";
import {
  HomeIcon,
  KeyIcon,
  ScaleIcon,
  TrophyIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";
import { compareRentVsBuy } from "@/core/finance/rent-vs-buy";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";
import { buildRentVsBuyEngineInputs } from "@/features/simulator/lib/rent-vs-buy-engine";
import { formatBRL } from "@/lib/formatters/currency";

const EMPTY_VALUE = "—";

export interface RentVsBuyKpiInput {
  rentVsBuy: RentVsBuyFormValues | null;
}

export function buildRentVsBuyKpis({
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

  if (!rentVsBuy) return empty;

  try {
    const result = compareRentVsBuy(buildRentVsBuyEngineInputs(rentVsBuy));
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
