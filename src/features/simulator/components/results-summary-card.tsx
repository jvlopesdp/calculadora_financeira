import { useMemo } from "react";
import Decimal from "decimal.js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
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
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { ExtraPaymentStrategy } from "@/features/simulator/hooks/simulation-context";

const EMPTY_STATE = "Preencha os dados para simular";
const ZERO = new Decimal(0);

function buildFinancingInputs(values: FinancingFormValues): FinancingInputs {
  const principal = new Decimal(values.propertyValue).minus(values.downPayment);
  const monthlyRate = new Decimal(values.monthlyRate).div(100);
  return {
    principal,
    monthlyRate,
    termMonths: values.termMonths,
    system: values.system,
  };
}

interface SummaryFigures {
  financedAmount: Decimal;
  initialInstallment: Decimal;
  baseTotalPaid: Decimal;
  baseTotalInterest: Decimal;
  originalTermMonths: number;
  extraTotalPaid: Decimal;
  extraTotalInterest: Decimal;
  interestSaved: Decimal;
  newTermMonths: number;
  monthsReduced: number;
}

function computeFigures(
  inputs: FinancingInputs,
  extraMonthly: number | null,
  strategy: ExtraPaymentStrategy,
): SummaryFigures {
  const baseSchedule =
    inputs.system === "SAC"
      ? generateSacSchedule(inputs)
      : generatePriceSchedule(inputs);
  const baseSummary = summarizeSchedule(baseSchedule, inputs.termMonths);
  const initialInstallment = baseSchedule[0]?.installment ?? ZERO;

  if (extraMonthly === null || extraMonthly <= 0) {
    return {
      financedAmount: inputs.principal,
      initialInstallment,
      baseTotalPaid: baseSummary.totalPaid,
      baseTotalInterest: baseSummary.totalInterest,
      originalTermMonths: inputs.termMonths,
      extraTotalPaid: baseSummary.totalPaid,
      extraTotalInterest: baseSummary.totalInterest,
      interestSaved: ZERO,
      newTermMonths: inputs.termMonths,
      monthsReduced: 0,
    };
  }

  const extra = new Decimal(extraMonthly);
  const result =
    strategy === "installment"
      ? applyPrepaymentReduceInstallment(inputs, extra)
      : applyPrepaymentReduceTerm(inputs, extra);
  return {
    financedAmount: inputs.principal,
    initialInstallment,
    baseTotalPaid: baseSummary.totalPaid,
    baseTotalInterest: baseSummary.totalInterest,
    originalTermMonths: inputs.termMonths,
    extraTotalPaid: result.summary.totalPaid,
    extraTotalInterest: result.summary.totalInterest,
    interestSaved: result.summary.interestSaved,
    newTermMonths: result.summary.newTermMonths,
    monthsReduced: result.summary.monthsReduced,
  };
}

interface MetricProps {
  label: string;
  value: string;
  className?: string;
  testId?: string;
}

function Metric({ label, value, className, testId }: MetricProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "bg-muted/40 border-border rounded-md border p-3",
        className,
      )}
    >
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-tabular mt-1 text-base font-semibold">{value}</dd>
    </div>
  );
}

interface DeltaMetricProps {
  label: string;
  delta: Decimal;
  testId?: string;
  className?: string;
}

function DeltaMetric({ label, delta, testId, className }: DeltaMetricProps) {
  const sign = delta.comparedTo(0);
  const tone =
    sign > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : sign < 0
        ? "text-destructive"
        : "text-foreground";
  return (
    <div
      data-testid={testId}
      data-delta-sign={sign > 0 ? "positive" : sign < 0 ? "negative" : "zero"}
      className={cn(
        "bg-muted/40 border-border rounded-md border p-3",
        className,
      )}
    >
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("font-tabular mt-1 text-base font-semibold", tone)}>
        {formatBRL(delta)}
      </dd>
    </div>
  );
}

export function ResultsSummaryCard() {
  const { financing, extraMonthly, extraStrategy } = useSimulation();

  const figures = useMemo<SummaryFigures | null>(() => {
    if (!financing) return null;
    try {
      const inputs = buildFinancingInputs(financing);
      return computeFigures(inputs, extraMonthly, extraStrategy);
    } catch {
      return null;
    }
  }, [financing, extraMonthly, extraStrategy]);

  return (
    <Card className="md:col-span-12">
      <CardHeader>
        <CardTitle>Resumo dos resultados</CardTitle>
        <CardDescription>
          Visão geral dos principais números da simulação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {figures === null ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="results-summary-empty-state"
          >
            {EMPTY_STATE}
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Valor financiado"
              value={formatBRL(figures.financedAmount)}
              testId="summary-financed-amount"
            />
            <Metric
              label="Parcela inicial"
              value={formatBRL(figures.initialInstallment)}
              testId="summary-initial-installment"
            />
            <Metric
              label="Prazo original"
              value={formatMonths(figures.originalTermMonths)}
              testId="summary-original-term"
            />
            <Metric
              label="Total pago (base)"
              value={formatBRL(figures.baseTotalPaid)}
              testId="summary-base-total-paid"
            />
            <Metric
              label="Total pago (com extra)"
              value={formatBRL(figures.extraTotalPaid)}
              testId="summary-extra-total-paid"
            />
            <DeltaMetric
              label="Economia total"
              delta={figures.interestSaved}
              testId="summary-interest-saved"
            />
            <Metric
              label="Total de juros (base)"
              value={formatBRL(figures.baseTotalInterest)}
              testId="summary-base-total-interest"
            />
            <Metric
              label="Total de juros (com extra)"
              value={formatBRL(figures.extraTotalInterest)}
              testId="summary-extra-total-interest"
            />
            <Metric
              label="Novo prazo"
              value={formatMonths(figures.newTermMonths)}
              testId="summary-new-term"
            />
            <Metric
              label="Meses reduzidos"
              value={formatMonths(figures.monthsReduced)}
              testId="summary-months-reduced"
              className="sm:col-span-2 lg:col-span-3"
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
