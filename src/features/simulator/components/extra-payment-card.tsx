import { useEffect, useId, useMemo } from "react";
import Decimal from "decimal.js";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CurrencyInput } from "@/components/finance/currency-input";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";
import { prepaymentSchema } from "@/features/simulator/schemas/prepayment";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentResult,
} from "@/core/finance/prepayment";
import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  summarizeSchedule,
  type FinancingInputs,
} from "@/core/finance/financial-types";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

type FormShape = {
  extraMonthly: number | null;
};

const defaultValues: FormShape = { extraMonthly: null };

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

interface PrepaymentMetrics {
  result: PrepaymentResult;
  baseTotalPaid: Decimal;
  diffVsBase: Decimal;
}

function computeMetrics(
  inputs: FinancingInputs,
  extra: Decimal,
  strategy: "term" | "installment",
  baseTotalPaid: Decimal,
): PrepaymentMetrics {
  const result =
    strategy === "term"
      ? applyPrepaymentReduceTerm(inputs, extra)
      : applyPrepaymentReduceInstallment(inputs, extra);
  return {
    result,
    baseTotalPaid,
    diffVsBase: result.summary.totalPaid.minus(baseTotalPaid),
  };
}

interface MetricProps {
  label: string;
  value: string;
  className?: string;
}

function Metric({ label, value, className }: MetricProps) {
  return (
    <div
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

interface ResultsViewProps {
  metrics: PrepaymentMetrics;
}

function ResultsView({ metrics }: ResultsViewProps) {
  const { summary } = metrics.result;
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Metric
        label="Economia em juros"
        value={formatBRL(summary.interestSaved)}
      />
      <Metric label="Total pago" value={formatBRL(summary.totalPaid)} />
      <Metric label="Novo prazo" value={formatMonths(summary.newTermMonths)} />
      <Metric
        label="Meses reduzidos"
        value={formatMonths(summary.monthsReduced)}
      />
      <Metric
        label="Diferença vs. base"
        value={formatBRL(metrics.diffVsBase)}
        className="sm:col-span-2"
      />
    </dl>
  );
}

const EMPTY_STATE = "Informe um valor extra para simular";
const FINANCING_MISSING_STATE =
  "Preencha os dados do financiamento para simular pagamentos extras";

export function ExtraPaymentCard() {
  const { financing, setExtraMonthly, extraStrategy, setExtraStrategy } =
    useSimulation();
  const {
    control,
    formState: { errors, isValid },
  } = useForm<FormShape>({
    resolver: zodResolver(prepaymentSchema),
    mode: "onChange",
    defaultValues,
  });

  const watched = useWatch({ control });
  const extraMonthlyId = useId();

  const extraMonthlyValue =
    typeof watched.extraMonthly === "number" &&
    Number.isFinite(watched.extraMonthly)
      ? watched.extraMonthly
      : null;

  useEffect(() => {
    if (!isValid) {
      setExtraMonthly(null);
      return;
    }
    setExtraMonthly(extraMonthlyValue);
  }, [extraMonthlyValue, isValid, setExtraMonthly]);

  const computed = useMemo(() => {
    if (!financing) return null;
    if (extraMonthlyValue === null || extraMonthlyValue <= 0) return null;
    const inputs = buildFinancingInputs(financing);
    const baseSchedule =
      inputs.system === "SAC"
        ? generateSacSchedule(inputs)
        : generatePriceSchedule(inputs);
    const baseSummary = summarizeSchedule(baseSchedule, inputs.termMonths);
    const extra = new Decimal(extraMonthlyValue);
    return {
      term: computeMetrics(inputs, extra, "term", baseSummary.totalPaid),
      installment: computeMetrics(
        inputs,
        extra,
        "installment",
        baseSummary.totalPaid,
      ),
    };
  }, [financing, extraMonthlyValue]);

  const showResults = computed !== null;
  const emptyMessage =
    extraMonthlyValue === null || extraMonthlyValue === 0
      ? EMPTY_STATE
      : FINANCING_MISSING_STATE;

  return (
    <Card className="md:col-span-5">
      <CardHeader>
        <CardTitle>Pagamento extra</CardTitle>
        <CardDescription>
          Simule pagamentos mensais adicionais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Formulário de pagamento extra"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={extraMonthlyId}>Pagamento extra mensal</Label>
            <Controller
              control={control}
              name="extraMonthly"
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id={extraMonthlyId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error ? `${extraMonthlyId}-error` : undefined
                  }
                />
              )}
            />
            {errors.extraMonthly?.message ? (
              <p
                id={`${extraMonthlyId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.extraMonthly.message}
              </p>
            ) : null}
          </div>
        </form>

        {showResults ? (
          <Tabs
            value={extraStrategy}
            onValueChange={(next) =>
              setExtraStrategy(next === "installment" ? "installment" : "term")
            }
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="term">Reduzir prazo</TabsTrigger>
              <TabsTrigger value="installment">Reduzir parcela</TabsTrigger>
            </TabsList>
            <TabsContent value="term">
              <ResultsView metrics={computed.term} />
            </TabsContent>
            <TabsContent value="installment">
              <ResultsView metrics={computed.installment} />
            </TabsContent>
          </Tabs>
        ) : (
          <p
            className="text-muted-foreground mt-6 text-sm"
            data-testid="extra-payment-empty-state"
          >
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
