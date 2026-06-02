import Decimal from "decimal.js";

import type { KpiCardData } from "@/components/section-cards";
import { formatBRL } from "@/lib/formatters/currency";

import type { TrackerCurves } from "./build-curves";

const ZERO = new Decimal(0);

const EMPTY_HINT = "Registre lançamentos para acompanhar o progresso.";

function placeholder(title: string): KpiCardData {
  return { title, value: "—", hint: EMPTY_HINT };
}

/**
 * KPIs do topo da página de plano, derivados das curvas (chokepoint US-017).
 * Sem lançamentos, os quatro cartões mostram "—" — a comparação Realizado vs
 * Normal só faz sentido depois do primeiro pagamento registrado.
 */
export function buildTrackerKpis(curves: TrackerCurves): KpiCardData[] {
  if (!curves.hasEntries || curves.lastEntryMonth === null) {
    return [
      placeholder("Saldo atual"),
      placeholder("Juros pagos até agora"),
      placeholder("Economia de juros vs Normal (Realizado)"),
      placeholder("Meses reduzidos vs Normal (Realizado)"),
    ];
  }

  const { normal, realized, lastEntryMonth } = curves;

  const realizedByMonth = new Map(
    realized.months.map((month) => [month.monthIndex, month]),
  );
  const rowAtLastEntry = realizedByMonth.get(lastEntryMonth);
  // Sem a row (cronograma truncado antes do mês), o saldo já foi quitado.
  const saldoAtual = rowAtLastEntry ? rowAtLastEntry.balance : ZERO;

  const jurosPagos = realized.months
    .filter((month) => month.monthIndex <= lastEntryMonth)
    .reduce((acc, month) => acc.plus(month.interest), ZERO);

  const totalInterestNormal = normal.reduce(
    (acc, month) => acc.plus(month.interest),
    ZERO,
  );
  const totalInterestRealized = realized.months.reduce(
    (acc, month) => acc.plus(month.interest),
    ZERO,
  );
  const economiaJuros = totalInterestNormal.minus(totalInterestRealized);

  const mesesReduzidos = normal.length - realized.months.length;

  return [
    { title: "Saldo atual", value: formatBRL(saldoAtual) },
    { title: "Juros pagos até agora", value: formatBRL(jurosPagos) },
    {
      title: "Economia de juros vs Normal (Realizado)",
      value: formatBRL(economiaJuros),
      trend: economiaJuros.greaterThan(ZERO) ? "up" : "neutral",
    },
    {
      title: "Meses reduzidos vs Normal (Realizado)",
      value: `${mesesReduzidos} ${mesesReduzidos === 1 ? "mês" : "meses"}`,
      trend: mesesReduzidos > 0 ? "up" : "neutral",
    },
  ];
}
