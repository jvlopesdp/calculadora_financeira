import Decimal from "decimal.js";
import {
  CalendarClockIcon,
  PercentIcon,
  PiggyBankIcon,
  ReceiptTextIcon,
  TimerResetIcon,
  WalletIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";
import { formatBRL } from "@/lib/formatters/currency";
import { formatPercentage } from "@/lib/formatters/percentage";

import type { TrackerCurves } from "./build-curves";

const ZERO = new Decimal(0);

const EMPTY_HINT = "Registre lançamentos para acompanhar o progresso.";

function placeholder(
  title: string,
  icon: KpiCardData["icon"],
): KpiCardData {
  return { title, value: "—", hint: EMPTY_HINT, icon };
}

/**
 * KPIs do topo da página "Meus Financiamentos" (US-009): derivados das curvas
 * computadas em `core/finance/tracker` (`buildCurves` orquestra
 * `normalSchedule`/`realizedSchedule`); a função apenas projeta os números nos
 * `KpiCardData` exibidos. Sem lançamentos, todos os cartões mostram "—" com a
 * instrução para registrar pagamentos — Realizado vs Normal só faz sentido
 * depois do primeiro pagamento.
 */
export function buildTrackerKpis(curves: TrackerCurves): KpiCardData[] {
  if (!curves.hasEntries || curves.lastEntryMonth === null) {
    return [
      placeholder("% já pago", PercentIcon),
      placeholder("Saldo devedor", WalletIcon),
      placeholder("Parcelas restantes", CalendarClockIcon),
      placeholder("Juros pagos até agora", ReceiptTextIcon),
      placeholder("Economia vs cronograma original", PiggyBankIcon),
      placeholder("Prazo reduzido", TimerResetIcon),
    ];
  }

  const { planInput, normal, realized, lastEntryMonth } = curves;
  const principal = planInput.principal;

  const realizedByMonth = new Map(
    realized.months.map((month) => [month.monthIndex, month]),
  );
  const rowAtLastEntry = realizedByMonth.get(lastEntryMonth);
  // Sem a row (cronograma truncado antes do mês), o saldo já foi quitado.
  const saldoDevedor = rowAtLastEntry ? rowAtLastEntry.balance : ZERO;

  const percentPaid = principal.greaterThan(ZERO)
    ? Decimal.min(
        principal.minus(saldoDevedor).div(principal).times(100),
        new Decimal(100),
      )
    : new Decimal(100);

  const parcelasRestantes = Math.max(
    0,
    realized.months.length - lastEntryMonth,
  );

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
    {
      title: "% já pago",
      value: formatPercentage(percentPaid, 1),
      icon: PercentIcon,
      trend: percentPaid.greaterThan(ZERO) ? "up" : "neutral",
    },
    {
      title: "Saldo devedor",
      value: formatBRL(saldoDevedor),
      icon: WalletIcon,
    },
    {
      title: "Parcelas restantes",
      value: parcelasRestantes.toString(),
      icon: CalendarClockIcon,
    },
    {
      title: "Juros pagos até agora",
      value: formatBRL(jurosPagos),
      icon: ReceiptTextIcon,
    },
    {
      title: "Economia vs cronograma original",
      value: formatBRL(economiaJuros),
      icon: PiggyBankIcon,
      trend: economiaJuros.greaterThan(ZERO) ? "up" : "neutral",
    },
    {
      title: "Prazo reduzido",
      value: `${mesesReduzidos} ${mesesReduzidos === 1 ? "mês" : "meses"}`,
      icon: TimerResetIcon,
      trend: mesesReduzidos > 0 ? "up" : "neutral",
    },
  ];
}
