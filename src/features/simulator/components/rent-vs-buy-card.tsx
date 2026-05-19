import { useEffect, useId, useMemo, useState } from "react";
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
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { PercentageInput } from "@/components/finance/percentage-input";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/currency";
import { formatPercentage } from "@/lib/formatters/percentage";
import { formatMonths } from "@/lib/formatters/number";
import {
  rentVsBuySchema,
  type RentVsBuyFormValues,
} from "@/features/simulator/schemas/rent-vs-buy";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  annualToMonthlyRate,
  compareRentVsBuy,
  type RentVsBuyInputs,
  type RentVsBuyResult,
} from "@/core/finance/rent-vs-buy";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

type HorizonUnit = "months" | "years";

type FormShape = {
  monthlyRent: number | null;
  annualRentAdjustment: number | null;
  annualInvestmentReturn: number | null;
  annualAppreciation: number | null;
  monthlyOwnershipCosts: number | null;
  horizonMonths: number | null;
};

const defaultValues: FormShape = {
  monthlyRent: null,
  annualRentAdjustment: null,
  annualInvestmentReturn: null,
  annualAppreciation: null,
  monthlyOwnershipCosts: 0,
  horizonMonths: null,
};

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

interface ScenarioBadgeProps {
  scenario: RentVsBuyResult["summary"]["bestScenario"];
}

function ScenarioBadge({ scenario }: ScenarioBadgeProps) {
  if (scenario === "buy") {
    return (
      <span
        data-testid="best-scenario-badge"
        data-scenario="buy"
        className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
      >
        Comprar
      </span>
    );
  }
  if (scenario === "rent") {
    return (
      <span
        data-testid="best-scenario-badge"
        data-scenario="rent"
        className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1 text-sm font-semibold text-sky-700 dark:text-sky-400"
      >
        Alugar e investir
      </span>
    );
  }
  return (
    <span
      data-testid="best-scenario-badge"
      data-scenario="tie"
      className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
    >
      Empate
    </span>
  );
}

const EMPTY_STATE = "Preencha os dados para comparar aluguel e compra";
const FINANCING_MISSING_STATE =
  "Preencha os dados do financiamento para comparar com aluguel";

export function RentVsBuyCard() {
  const { financing, setRentVsBuy } = useSimulation();
  const [horizonUnit, setHorizonUnit] = useState<HorizonUnit>("months");

  const {
    control,
    register,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormShape>({
    resolver: zodResolver(rentVsBuySchema),
    mode: "onChange",
    defaultValues,
  });

  const watched = useWatch({ control });

  const monthlyRentId = useId();
  const annualRentAdjustmentId = useId();
  const annualInvestmentReturnId = useId();
  const monthlyEquivalentId = useId();
  const annualAppreciationId = useId();
  const monthlyOwnershipCostsId = useId();
  const horizonValueId = useId();
  const horizonUnitId = useId();

  const horizonRegister = register("horizonMonths", {
    setValueAs: (raw) => {
      if (raw === "" || raw === null || raw === undefined) return null;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return raw;
      return horizonUnit === "years" ? parsed * 12 : parsed;
    },
  });

  const horizonDisplayValue = useMemo(() => {
    const months = watched.horizonMonths;
    if (typeof months !== "number" || !Number.isFinite(months)) return "";
    if (horizonUnit === "years") {
      const years = months / 12;
      return Number.isInteger(years) ? String(years) : years.toFixed(2);
    }
    return String(months);
  }, [watched.horizonMonths, horizonUnit]);

  const monthlyInvestmentRateLabel = useMemo(() => {
    const annual = watched.annualInvestmentReturn;
    if (typeof annual !== "number" || !Number.isFinite(annual)) return null;
    if (annual < 0) return null;
    const monthly = annualToMonthlyRate(new Decimal(annual).div(100));
    return formatPercentage(monthly.times(100), 4);
  }, [watched.annualInvestmentReturn]);

  useEffect(() => {
    if (!isValid) {
      setRentVsBuy(null);
      return;
    }
    const values: RentVsBuyFormValues = {
      monthlyRent: watched.monthlyRent ?? 0,
      annualRentAdjustment: watched.annualRentAdjustment ?? 0,
      annualInvestmentReturn: watched.annualInvestmentReturn ?? 0,
      annualAppreciation: watched.annualAppreciation ?? 0,
      monthlyOwnershipCosts: watched.monthlyOwnershipCosts ?? 0,
      horizonMonths: watched.horizonMonths ?? 0,
    };
    setRentVsBuy(values);
  }, [
    isValid,
    watched.monthlyRent,
    watched.annualRentAdjustment,
    watched.annualInvestmentReturn,
    watched.annualAppreciation,
    watched.monthlyOwnershipCosts,
    watched.horizonMonths,
    setRentVsBuy,
  ]);

  const result = useMemo(() => {
    if (!financing || !isValid) return null;
    const values: RentVsBuyFormValues = {
      monthlyRent: watched.monthlyRent ?? 0,
      annualRentAdjustment: watched.annualRentAdjustment ?? 0,
      annualInvestmentReturn: watched.annualInvestmentReturn ?? 0,
      annualAppreciation: watched.annualAppreciation ?? 0,
      monthlyOwnershipCosts: watched.monthlyOwnershipCosts ?? 0,
      horizonMonths: watched.horizonMonths ?? 0,
    };
    try {
      return compareRentVsBuy(buildEngineInputs(financing, values));
    } catch {
      return null;
    }
  }, [
    financing,
    isValid,
    watched.monthlyRent,
    watched.annualRentAdjustment,
    watched.annualInvestmentReturn,
    watched.annualAppreciation,
    watched.monthlyOwnershipCosts,
    watched.horizonMonths,
  ]);

  const emptyMessage = !isValid
    ? EMPTY_STATE
    : !financing
      ? FINANCING_MISSING_STATE
      : EMPTY_STATE;

  const finalBuyNetWorth = result
    ? result.buyTimeline[result.buyTimeline.length - 1].netWorth
    : null;
  const finalRentNetWorth = result
    ? result.rentTimeline[result.rentTimeline.length - 1].netWorth
    : null;

  return (
    <Card className="md:col-span-12">
      <CardHeader>
        <CardTitle>Aluguel vs. compra</CardTitle>
        <CardDescription>
          Compare comprar via financiamento com alugar e investir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Formulário de aluguel vs. compra"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={monthlyRentId}>Aluguel mensal</Label>
            <Controller
              control={control}
              name="monthlyRent"
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id={monthlyRentId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error ? `${monthlyRentId}-error` : undefined
                  }
                />
              )}
            />
            {errors.monthlyRent?.message ? (
              <p
                id={`${monthlyRentId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.monthlyRent.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={annualRentAdjustmentId}>
              Reajuste anual do aluguel
            </Label>
            <Controller
              control={control}
              name="annualRentAdjustment"
              render={({ field, fieldState }) => (
                <PercentageInput
                  id={annualRentAdjustmentId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error
                      ? `${annualRentAdjustmentId}-error`
                      : undefined
                  }
                />
              )}
            />
            {errors.annualRentAdjustment?.message ? (
              <p
                id={`${annualRentAdjustmentId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.annualRentAdjustment.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={annualInvestmentReturnId}>
              Rendimento anual do investimento
            </Label>
            <Controller
              control={control}
              name="annualInvestmentReturn"
              render={({ field, fieldState }) => (
                <PercentageInput
                  id={annualInvestmentReturnId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error
                      ? `${annualInvestmentReturnId}-error`
                      : undefined
                  }
                />
              )}
            />
            {errors.annualInvestmentReturn?.message ? (
              <p
                id={`${annualInvestmentReturnId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.annualInvestmentReturn.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={monthlyEquivalentId}>
              Rendimento mensal equivalente
            </Label>
            <output
              id={monthlyEquivalentId}
              className="border-input bg-muted text-muted-foreground font-tabular flex h-9 w-full items-center rounded-md border px-3 text-sm"
              aria-live="polite"
            >
              {monthlyInvestmentRateLabel ?? "—"}
            </output>
            <p className="text-muted-foreground text-xs">
              (1 + taxa anual)<sup>1/12</sup> − 1
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={annualAppreciationId}>
              Valorização anual do imóvel
            </Label>
            <Controller
              control={control}
              name="annualAppreciation"
              render={({ field, fieldState }) => (
                <PercentageInput
                  id={annualAppreciationId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error
                      ? `${annualAppreciationId}-error`
                      : undefined
                  }
                />
              )}
            />
            {errors.annualAppreciation?.message ? (
              <p
                id={`${annualAppreciationId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.annualAppreciation.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={monthlyOwnershipCostsId}>
              Custos mensais de propriedade
            </Label>
            <Controller
              control={control}
              name="monthlyOwnershipCosts"
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id={monthlyOwnershipCostsId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error
                      ? `${monthlyOwnershipCostsId}-error`
                      : undefined
                  }
                />
              )}
            />
            <p className="text-muted-foreground text-xs">
              IPTU, condomínio, manutenção. Opcional.
            </p>
            {errors.monthlyOwnershipCosts?.message ? (
              <p
                id={`${monthlyOwnershipCostsId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.monthlyOwnershipCosts.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor={horizonValueId}>Horizonte</Label>
            <div className="flex gap-2">
              <input
                id={horizonValueId}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder={horizonUnit === "years" ? "30" : "360"}
                value={horizonDisplayValue}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-invalid={errors.horizonMonths ? true : undefined}
                aria-describedby={
                  errors.horizonMonths ? `${horizonValueId}-error` : undefined
                }
                onChange={horizonRegister.onChange}
                onBlur={horizonRegister.onBlur}
                name={horizonRegister.name}
                ref={horizonRegister.ref}
              />
              <Select
                id={horizonUnitId}
                aria-label="Unidade do horizonte"
                value={horizonUnit}
                onChange={(event) => {
                  const next = event.target.value as HorizonUnit;
                  setHorizonUnit(next);
                  const currentMonths = watched.horizonMonths;
                  if (
                    typeof currentMonths === "number" &&
                    Number.isFinite(currentMonths)
                  ) {
                    setValue("horizonMonths", currentMonths, {
                      shouldValidate: true,
                    });
                  }
                }}
                className="w-32"
              >
                <option value="months">meses</option>
                <option value="years">anos</option>
              </Select>
            </div>
            {errors.horizonMonths?.message ? (
              <p
                id={`${horizonValueId}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.horizonMonths.message}
              </p>
            ) : null}
          </div>
        </form>

        {result &&
        financing &&
        finalBuyNetWorth !== null &&
        finalRentNetWorth !== null ? (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
                Melhor cenário:
              </span>
              <ScenarioBadge scenario={result.summary.bestScenario} />
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric
                label="Patrimônio final (comprar)"
                value={formatBRL(finalBuyNetWorth)}
              />
              <Metric
                label="Patrimônio final (alugar)"
                value={formatBRL(finalRentNetWorth)}
              />
              <Metric
                label="Diferença"
                value={formatBRL(result.summary.netWorthDifferenceFinal)}
              />
              <Metric
                label="Ponto de equilíbrio"
                value={
                  result.summary.breakEvenMonth === null
                    ? "Não atinge ponto de equilíbrio"
                    : formatMonths(result.summary.breakEvenMonth)
                }
              />
            </dl>
          </div>
        ) : (
          <p
            className="text-muted-foreground mt-6 text-sm"
            data-testid="rent-vs-buy-empty-state"
          >
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
