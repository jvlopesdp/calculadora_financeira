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
import { targetPaymentSchema } from "@/features/simulator/schemas/target-payment";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import { calculatePriceInstallment } from "@/core/finance/price-calculator";
import { roundMoney } from "@/core/finance/financial-types";
import {
  resolveExtraFromTargetPayment,
  type ResolveExtraFromTargetPaymentResult,
} from "@/core/finance/target-payment";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

type FormShape = {
  target: number | null;
};

const defaultValues: FormShape = { target: null };

interface PriceInputs {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
}

function buildPriceInputs(values: FinancingFormValues): PriceInputs {
  const principal = new Decimal(values.propertyValue).minus(values.downPayment);
  const monthlyRate = new Decimal(values.monthlyRate).div(100);
  return { principal, monthlyRate, termMonths: values.termMonths };
}

function calcBasePriceInstallment(values: FinancingFormValues): Decimal | null {
  try {
    return roundMoney(calculatePriceInstallment(buildPriceInputs(values)));
  } catch {
    return null;
  }
}

interface ResultMetrics {
  result: ResolveExtraFromTargetPaymentResult;
  baseTotalPaid: Decimal;
  diffVsBase: Decimal;
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

function ResultsView({ metrics }: { metrics: ResultMetrics }) {
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

const EMPTY_NO_FINANCING =
  "Preencha os dados do financiamento para informar a parcela desejada";
const EMPTY_NO_TARGET =
  "Informe uma parcela mensal desejada superior à parcela mínima para simular";

export function TargetPaymentCard() {
  const { financing, setExtraMonthly, extraStrategy, setExtraStrategy } =
    useSimulation();

  const basePriceInstallment = useMemo<Decimal | null>(() => {
    if (!financing) return null;
    return calcBasePriceInstallment(financing);
  }, [financing]);

  const {
    control,
    formState: { errors, isValid },
  } = useForm<FormShape>({
    resolver: zodResolver(targetPaymentSchema),
    mode: "onChange",
    defaultValues,
  });

  const watched = useWatch({ control });
  const targetId = useId();

  const targetValue =
    typeof watched.target === "number" && Number.isFinite(watched.target)
      ? watched.target
      : null;

  const extraCalculated = useMemo<Decimal | null>(() => {
    if (basePriceInstallment === null || targetValue === null) return null;
    return roundMoney(new Decimal(targetValue).minus(basePriceInstallment));
  }, [basePriceInstallment, targetValue]);

  const minPaymentError = useMemo<string | null>(() => {
    if (basePriceInstallment === null || targetValue === null) return null;
    if (new Decimal(targetValue).lessThan(basePriceInstallment)) {
      return `Parcela desejada deve ser ≥ ${formatBRL(basePriceInstallment)}`;
    }
    return null;
  }, [basePriceInstallment, targetValue]);

  const schemaError = errors.target?.message ?? null;
  const inlineError = schemaError ?? minPaymentError;

  useEffect(() => {
    if (
      !isValid ||
      minPaymentError !== null ||
      extraCalculated === null ||
      extraCalculated.isNegative()
    ) {
      setExtraMonthly(null);
      return;
    }
    setExtraMonthly(extraCalculated.toNumber());
  }, [extraCalculated, isValid, minPaymentError, setExtraMonthly]);

  const computed = useMemo(() => {
    if (
      !financing ||
      basePriceInstallment === null ||
      targetValue === null ||
      extraCalculated === null ||
      extraCalculated.lessThanOrEqualTo(0)
    ) {
      return null;
    }
    const inputs = buildPriceInputs(financing);
    const targetMonthlyPayment = new Decimal(targetValue);
    const baseRun = resolveExtraFromTargetPayment({
      ...inputs,
      targetMonthlyPayment: basePriceInstallment,
    });
    const baseTotalPaid = baseRun.summary.totalPaid;
    const term = resolveExtraFromTargetPayment({
      ...inputs,
      targetMonthlyPayment,
      strategy: "reduce-term",
    });
    const installment = resolveExtraFromTargetPayment({
      ...inputs,
      targetMonthlyPayment,
      strategy: "reduce-installment",
    });
    return {
      term: {
        result: term,
        baseTotalPaid,
        diffVsBase: term.summary.totalPaid.minus(baseTotalPaid),
      },
      installment: {
        result: installment,
        baseTotalPaid,
        diffVsBase: installment.summary.totalPaid.minus(baseTotalPaid),
      },
    };
  }, [financing, basePriceInstallment, targetValue, extraCalculated]);

  const showResults = computed !== null;
  const emptyMessage = !financing ? EMPTY_NO_FINANCING : EMPTY_NO_TARGET;
  const showExtraCalculated =
    inlineError === null &&
    extraCalculated !== null &&
    extraCalculated.greaterThan(0);

  return (
    <Card className="md:col-span-5">
      <CardHeader>
        <CardTitle>Parcela mensal desejada</CardTitle>
        <CardDescription>
          Informe o valor que você pretende pagar por mês (parcela base +
          adicional).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Formulário da parcela mensal desejada"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={targetId}>Parcela mensal desejada</Label>
            <Controller
              control={control}
              name="target"
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id={targetId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={
                    fieldState.invalid || minPaymentError !== null || undefined
                  }
                  aria-describedby={
                    inlineError
                      ? `${targetId}-error`
                      : basePriceInstallment !== null
                        ? `${targetId}-helper`
                        : undefined
                  }
                />
              )}
            />
            {basePriceInstallment !== null && inlineError === null ? (
              <p
                id={`${targetId}-helper`}
                className="text-muted-foreground text-xs"
                data-testid="target-payment-min-helper"
              >
                Parcela mínima: {formatBRL(basePriceInstallment)}
              </p>
            ) : null}
            {inlineError ? (
              <p
                id={`${targetId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {inlineError}
              </p>
            ) : null}
            {showExtraCalculated ? (
              <p
                className="text-muted-foreground text-xs"
                data-testid="target-payment-extra-calculated"
              >
                Extra calculado:{" "}
                <span className="text-foreground font-semibold">
                  {formatBRL(extraCalculated)}
                </span>
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
            data-testid="target-payment-empty-state"
          >
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
