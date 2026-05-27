import Decimal from "decimal.js";
import {
  CalculatorIcon,
  ClockIcon,
  PercentIcon,
  WalletIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";
import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  summarizeSchedule,
  type FinancingInputs,
} from "@/core/finance/financial-types";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
} from "@/core/finance/prepayment";
import type { ExtraPaymentStrategy } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";

const EMPTY_VALUE = "—";
const ZERO = new Decimal(0);

function buildInputs(values: FinancingFormValues): FinancingInputs {
  const principal = new Decimal(values.propertyValue).minus(values.downPayment);
  const monthlyRate = new Decimal(values.monthlyRate).div(100);
  return {
    principal,
    monthlyRate,
    termMonths: values.termMonths,
    system: values.system,
  };
}

export interface FinanciamentoKpiInput {
  financing: FinancingFormValues | null;
  extraMonthly: number | null;
  extraStrategy: ExtraPaymentStrategy;
}

export function buildFinanciamentoKpis({
  financing,
  extraMonthly,
  extraStrategy,
}: FinanciamentoKpiInput): KpiCardData[] {
  const empty: KpiCardData[] = [
    {
      title: "Parcela base",
      value: EMPTY_VALUE,
      icon: CalculatorIcon,
    },
    {
      title: "Parcela desejada",
      value: EMPTY_VALUE,
      icon: WalletIcon,
    },
    {
      title: "Total de juros",
      value: EMPTY_VALUE,
      icon: PercentIcon,
    },
    {
      title: "Prazo efetivo",
      value: EMPTY_VALUE,
      icon: ClockIcon,
    },
  ];

  if (!financing) return empty;

  try {
    const inputs = buildInputs(financing);
    const baseSchedule =
      inputs.system === "SAC"
        ? generateSacSchedule(inputs)
        : generatePriceSchedule(inputs);
    const baseInstallment = baseSchedule[0]?.installment ?? ZERO;
    const baseSummary = summarizeSchedule(baseSchedule, inputs.termMonths);

    const hasExtra = extraMonthly !== null && extraMonthly > 0;
    const extra = hasExtra ? new Decimal(extraMonthly!) : ZERO;
    const result = hasExtra
      ? extraStrategy === "installment"
        ? applyPrepaymentReduceInstallment(inputs, extra)
        : applyPrepaymentReduceTerm(inputs, extra)
      : null;

    const totalInterestEffective = result
      ? result.summary.totalInterest
      : baseSummary.totalInterest;
    const interestSaved = result ? result.summary.interestSaved : ZERO;
    const effectiveTerm = result
      ? result.summary.newTermMonths
      : inputs.termMonths;
    const monthsReduced = result ? result.summary.monthsReduced : 0;

    const desiredInstallment = hasExtra ? baseInstallment.plus(extra) : null;

    const parcelaBaseCard: KpiCardData = {
      title: "Parcela base",
      value: formatBRL(baseInstallment),
      hint: financing.system === "SAC" ? "Primeira parcela SAC" : "PRICE",
      icon: CalculatorIcon,
    };

    const parcelaDesejadaCard: KpiCardData = desiredInstallment
      ? {
          title: "Parcela desejada",
          value: formatBRL(desiredInstallment),
          delta: `+${formatBRL(extra)}`,
          trend: "up",
          icon: WalletIcon,
        }
      : {
          title: "Parcela desejada",
          value: formatBRL(baseInstallment),
          hint: "Sem pagamento extra",
          icon: WalletIcon,
        };

    const totalJurosCard: KpiCardData = {
      title: "Total de juros",
      value: formatBRL(totalInterestEffective),
      delta: interestSaved.greaterThan(0)
        ? `-${formatBRL(interestSaved)}`
        : undefined,
      trend: interestSaved.greaterThan(0) ? "down" : "neutral",
      icon: PercentIcon,
    };

    const prazoCard: KpiCardData = {
      title: "Prazo efetivo",
      value: formatMonths(effectiveTerm),
      delta:
        monthsReduced > 0 ? `-${formatMonths(monthsReduced)}` : undefined,
      trend: monthsReduced > 0 ? "down" : "neutral",
      icon: ClockIcon,
    };

    return [parcelaBaseCard, parcelaDesejadaCard, totalJurosCard, prazoCard];
  } catch {
    return empty;
  }
}
