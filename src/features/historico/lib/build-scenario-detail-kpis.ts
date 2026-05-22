import Decimal from "decimal.js";
import {
  CalendarClockIcon,
  PiggyBankIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";
import type { CurrentState } from "@/core/finance/replay-payments";
import { formatBRL } from "@/lib/formatters/currency";

const ZERO = new Decimal(0);

/**
 * KPIs for the scenario-detail page. All values are derived from the result of
 * `replayPayments(...)`; "economia acumulada" compares total interest under
 * the baseline schedule against total interest under the actual + projected
 * remaining schedule.
 */
export function buildScenarioDetailKpis(state: CurrentState): KpiCardData[] {
  const baselineInterest = state.baselineSchedule.reduce(
    (acc, row) => acc.plus(row.interest),
    ZERO,
  );
  const projectedInterest = state.paidInterest.plus(
    state.remainingSchedule.reduce(
      (acc, row) => acc.plus(row.interest),
      ZERO,
    ),
  );
  const savings = baselineInterest.minus(projectedInterest);
  const savingsTrend = savings.greaterThan(0)
    ? "up"
    : savings.lessThan(0)
      ? "down"
      : "neutral";
  const savingsValue = savings.greaterThan(0)
    ? formatBRL(savings)
    : savings.lessThan(0)
      ? formatBRL(savings.abs())
      : formatBRL(0);

  return [
    {
      title: "Saldo devedor",
      value: formatBRL(state.currentBalance),
      hint: "Atualizado a partir dos pagamentos registrados",
      icon: WalletIcon,
    },
    {
      title: "Parcelas restantes",
      value: state.remainingMonths.toString(),
      hint: "Projeção com base nos pagamentos reais",
      icon: CalendarClockIcon,
    },
    {
      title: "Já pago em juros",
      value: formatBRL(state.paidInterest),
      hint: "Soma dos juros pagos até hoje",
      icon: ReceiptTextIcon,
    },
    {
      title: "Economia acumulada",
      value: savingsValue,
      trend: savingsTrend,
      hint:
        savingsTrend === "up"
          ? "Versus o cronograma original"
          : savingsTrend === "down"
            ? "Maior custo de juros vs. cronograma original"
            : "Em linha com o cronograma original",
      icon: PiggyBankIcon,
    },
  ];
}
