import { useEffect, useId, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CurrencyInput } from "@/components/finance/currency-input";
import { PercentageInput } from "@/components/finance/percentage-input";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/currency";
import { formatPercentage } from "@/lib/formatters/percentage";
import {
  RENT_VS_BUY_DEFAULTS,
  rentVsBuySchema,
  type RentVsBuyFormValues,
} from "@/features/simulator/schemas/rent-vs-buy";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  annualToMonthlyRate,
  compareRentVsBuy,
  type RentVsBuyResult,
} from "@/core/finance/rent-vs-buy";
import { buildRentVsBuyEngineInputs } from "@/features/simulator/lib/rent-vs-buy-engine";
import { formatMonths } from "@/lib/formatters/number";

type HorizonUnit = "months" | "years";

/**
 * Form default values. `monthlyRent` is intentionally omitted so the user must
 * supply it — the form starts invalid and the empty state remains visible until
 * the rent is entered.
 */
const FORM_DEFAULTS = {
  propertyValue: RENT_VS_BUY_DEFAULTS.propertyValue,
  downPayment: RENT_VS_BUY_DEFAULTS.downPayment,
  termMonths: RENT_VS_BUY_DEFAULTS.termMonths,
  annualRate: RENT_VS_BUY_DEFAULTS.annualRate,
  annualRentAdjustment: RENT_VS_BUY_DEFAULTS.annualRentAdjustment,
  annualInvestmentReturn: RENT_VS_BUY_DEFAULTS.annualInvestmentReturn,
  annualAppreciation: RENT_VS_BUY_DEFAULTS.annualAppreciation,
  purchaseCostPct: RENT_VS_BUY_DEFAULTS.purchaseCostPct,
  saleCostPct: RENT_VS_BUY_DEFAULTS.saleCostPct,
  monthlyOwnershipCosts: RENT_VS_BUY_DEFAULTS.monthlyOwnershipCosts,
  horizonMonths: RENT_VS_BUY_DEFAULTS.horizonMonths,
} satisfies Partial<RentVsBuyFormValues>;

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

interface FieldLabelProps {
  htmlFor: string;
  children: React.ReactNode;
  tooltip: string;
}

function FieldLabel({ htmlFor, children, tooltip }: FieldLabelProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Mais informações sobre ${typeof children === "string" ? children : "este campo"}`}
            className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <InfoIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

const EMPTY_STATE = "Preencha os dados para comparar aluguel e compra";

export function RentVsBuyCard() {
  const { setRentVsBuy } = useSimulation();
  const [horizonUnit, setHorizonUnit] = useState<HorizonUnit>("months");

  const {
    control,
    register,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<RentVsBuyFormValues>({
    resolver: zodResolver(rentVsBuySchema),
    mode: "onChange",
    defaultValues: FORM_DEFAULTS,
  });

  const watched = useWatch({ control });

  const propertyValueId = useId();
  const downPaymentId = useId();
  const termMonthsId = useId();
  const annualRateId = useId();
  const monthlyRentId = useId();
  const annualRentAdjustmentId = useId();
  const annualInvestmentReturnId = useId();
  const monthlyEquivalentId = useId();
  const annualAppreciationId = useId();
  const purchaseCostPctId = useId();
  const saleCostPctId = useId();
  const monthlyOwnershipCostsId = useId();
  const horizonValueId = useId();
  const horizonUnitId = useId();

  const termRegister = register("termMonths", {
    setValueAs: (raw) => {
      if (raw === "" || raw === null || raw === undefined) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    },
  });

  const horizonRegister = register("horizonMonths", {
    setValueAs: (raw) => {
      if (raw === "" || raw === null || raw === undefined) return undefined;
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
      propertyValue: watched.propertyValue ?? RENT_VS_BUY_DEFAULTS.propertyValue,
      downPayment: watched.downPayment ?? RENT_VS_BUY_DEFAULTS.downPayment,
      termMonths: watched.termMonths ?? RENT_VS_BUY_DEFAULTS.termMonths,
      annualRate: watched.annualRate ?? RENT_VS_BUY_DEFAULTS.annualRate,
      monthlyRent: watched.monthlyRent ?? 0,
      annualRentAdjustment:
        watched.annualRentAdjustment ?? RENT_VS_BUY_DEFAULTS.annualRentAdjustment,
      annualInvestmentReturn:
        watched.annualInvestmentReturn ??
        RENT_VS_BUY_DEFAULTS.annualInvestmentReturn,
      annualAppreciation:
        watched.annualAppreciation ?? RENT_VS_BUY_DEFAULTS.annualAppreciation,
      purchaseCostPct:
        watched.purchaseCostPct ?? RENT_VS_BUY_DEFAULTS.purchaseCostPct,
      saleCostPct: watched.saleCostPct ?? RENT_VS_BUY_DEFAULTS.saleCostPct,
      monthlyOwnershipCosts:
        watched.monthlyOwnershipCosts ??
        RENT_VS_BUY_DEFAULTS.monthlyOwnershipCosts,
      horizonMonths:
        watched.horizonMonths ?? RENT_VS_BUY_DEFAULTS.horizonMonths,
    };
    setRentVsBuy(values);
  }, [
    isValid,
    watched.propertyValue,
    watched.downPayment,
    watched.termMonths,
    watched.annualRate,
    watched.monthlyRent,
    watched.annualRentAdjustment,
    watched.annualInvestmentReturn,
    watched.annualAppreciation,
    watched.purchaseCostPct,
    watched.saleCostPct,
    watched.monthlyOwnershipCosts,
    watched.horizonMonths,
    setRentVsBuy,
  ]);

  const result = useMemo<RentVsBuyResult | null>(() => {
    if (!isValid) return null;
    const values: RentVsBuyFormValues = {
      propertyValue: watched.propertyValue ?? RENT_VS_BUY_DEFAULTS.propertyValue,
      downPayment: watched.downPayment ?? RENT_VS_BUY_DEFAULTS.downPayment,
      termMonths: watched.termMonths ?? RENT_VS_BUY_DEFAULTS.termMonths,
      annualRate: watched.annualRate ?? RENT_VS_BUY_DEFAULTS.annualRate,
      monthlyRent: watched.monthlyRent ?? 0,
      annualRentAdjustment:
        watched.annualRentAdjustment ?? RENT_VS_BUY_DEFAULTS.annualRentAdjustment,
      annualInvestmentReturn:
        watched.annualInvestmentReturn ??
        RENT_VS_BUY_DEFAULTS.annualInvestmentReturn,
      annualAppreciation:
        watched.annualAppreciation ?? RENT_VS_BUY_DEFAULTS.annualAppreciation,
      purchaseCostPct:
        watched.purchaseCostPct ?? RENT_VS_BUY_DEFAULTS.purchaseCostPct,
      saleCostPct: watched.saleCostPct ?? RENT_VS_BUY_DEFAULTS.saleCostPct,
      monthlyOwnershipCosts:
        watched.monthlyOwnershipCosts ??
        RENT_VS_BUY_DEFAULTS.monthlyOwnershipCosts,
      horizonMonths:
        watched.horizonMonths ?? RENT_VS_BUY_DEFAULTS.horizonMonths,
    };
    try {
      return compareRentVsBuy(buildRentVsBuyEngineInputs(values));
    } catch {
      return null;
    }
  }, [
    isValid,
    watched.propertyValue,
    watched.downPayment,
    watched.termMonths,
    watched.annualRate,
    watched.monthlyRent,
    watched.annualRentAdjustment,
    watched.annualInvestmentReturn,
    watched.annualAppreciation,
    watched.purchaseCostPct,
    watched.saleCostPct,
    watched.monthlyOwnershipCosts,
    watched.horizonMonths,
  ]);

  const emptyMessage = EMPTY_STATE;

  const finalBuyNetWorth = result
    ? result.buyTimeline[result.buyTimeline.length - 1].netWorth
    : null;
  const finalRentNetWorth = result
    ? result.rentTimeline[result.rentTimeline.length - 1].netWorth
    : null;

  const diferencaPctLabel = useMemo(() => {
    if (!finalBuyNetWorth || !finalRentNetWorth) return null;
    if (finalRentNetWorth.isZero()) return null;
    const pct = finalBuyNetWorth
      .minus(finalRentNetWorth)
      .div(finalRentNetWorth.abs())
      .times(100);
    return formatPercentage(pct, 2);
  }, [finalBuyNetWorth, finalRentNetWorth]);

  return (
    <Card className="md:col-span-12">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Aluguel vs. compra</CardTitle>
          <CardDescription>
            Compare comprar via financiamento com alugar e investir.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            reset(FORM_DEFAULTS);
            setHorizonUnit("months");
          }}
        >
          Restaurar padrões
        </Button>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <form
            noValidate
            aria-label="Formulário de aluguel vs. compra"
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={propertyValueId}
                tooltip="Valor de mercado do imóvel que você simula comprar."
              >
                Valor do imóvel
              </FieldLabel>
              <Controller
                control={control}
                name="propertyValue"
                render={({ field, fieldState }) => (
                  <CurrencyInput
                    id={propertyValueId}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={
                      fieldState.error ? `${propertyValueId}-error` : undefined
                    }
                  />
                )}
              />
              {errors.propertyValue?.message ? (
                <p
                  id={`${propertyValueId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.propertyValue.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={downPaymentId}
                tooltip="Valor pago à vista como entrada. Deve ser menor que o valor do imóvel."
              >
                Entrada
              </FieldLabel>
              <Controller
                control={control}
                name="downPayment"
                render={({ field, fieldState }) => (
                  <CurrencyInput
                    id={downPaymentId}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={
                      fieldState.error ? `${downPaymentId}-error` : undefined
                    }
                  />
                )}
              />
              {errors.downPayment?.message ? (
                <p
                  id={`${downPaymentId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.downPayment.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={termMonthsId}
                tooltip="Duração do financiamento em meses. 360 meses = 30 anos."
              >
                Prazo (meses)
              </FieldLabel>
              <input
                id={termMonthsId}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="360"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-invalid={errors.termMonths ? true : undefined}
                aria-describedby={
                  errors.termMonths ? `${termMonthsId}-error` : undefined
                }
                defaultValue={FORM_DEFAULTS.termMonths}
                {...termRegister}
              />
              {errors.termMonths?.message ? (
                <p
                  id={`${termMonthsId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.termMonths.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={annualRateId}
                tooltip="Taxa de juros anual efetiva do financiamento (CET). Ex.: 10% a.a."
              >
                Taxa de juros anual
              </FieldLabel>
              <Controller
                control={control}
                name="annualRate"
                render={({ field, fieldState }) => (
                  <PercentageInput
                    id={annualRateId}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    decimals={2}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={
                      fieldState.error ? `${annualRateId}-error` : undefined
                    }
                  />
                )}
              />
              {errors.annualRate?.message ? (
                <p
                  id={`${annualRateId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.annualRate.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={monthlyRentId}
                tooltip="Valor mensal do aluguel equivalente que você pagaria para morar em um imóvel similar."
              >
                Aluguel mensal
              </FieldLabel>
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
              <FieldLabel
                htmlFor={annualRentAdjustmentId}
                tooltip="Reajuste anual contratual do aluguel (IGP-M / IPCA). Ex.: 4% a.a."
              >
                Reajuste anual do aluguel
              </FieldLabel>
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
              <FieldLabel
                htmlFor={annualInvestmentReturnId}
                tooltip="Rendimento anual esperado de investir o que sobra (CDB, Tesouro, etc.). Ex.: 12% a.a."
              >
                Rendimento anual do investimento
              </FieldLabel>
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
              <FieldLabel
                htmlFor={monthlyEquivalentId}
                tooltip="Taxa mensal equivalente: (1 + taxa anual)^(1/12) − 1."
              >
                Rendimento mensal equivalente
              </FieldLabel>
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
              <FieldLabel
                htmlFor={annualAppreciationId}
                tooltip="Valorização anual esperada do imóvel. Ex.: 6% a.a."
              >
                Valorização anual do imóvel
              </FieldLabel>
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
              <FieldLabel
                htmlFor={purchaseCostPctId}
                tooltip="Custos de aquisição: ITBI + escritura + registro. Geralmente 3% sobre o valor do imóvel."
              >
                Custo de aquisição (ITBI + escritura)
              </FieldLabel>
              <Controller
                control={control}
                name="purchaseCostPct"
                render={({ field, fieldState }) => (
                  <PercentageInput
                    id={purchaseCostPctId}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={
                      fieldState.error
                        ? `${purchaseCostPctId}-error`
                        : undefined
                    }
                  />
                )}
              />
              {errors.purchaseCostPct?.message ? (
                <p
                  id={`${purchaseCostPctId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.purchaseCostPct.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={saleCostPctId}
                tooltip="Custos de venda: corretagem imobiliária. Geralmente 6% sobre o valor do imóvel."
              >
                Custo de venda (corretagem)
              </FieldLabel>
              <Controller
                control={control}
                name="saleCostPct"
                render={({ field, fieldState }) => (
                  <PercentageInput
                    id={saleCostPctId}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={
                      fieldState.error ? `${saleCostPctId}-error` : undefined
                    }
                  />
                )}
              />
              {errors.saleCostPct?.message ? (
                <p
                  id={`${saleCostPctId}-error`}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {errors.saleCostPct.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor={monthlyOwnershipCostsId}
                tooltip="Custos mensais ao morar no imóvel próprio: IPTU, condomínio, manutenção. Opcional."
              >
                Custos mensais de propriedade
              </FieldLabel>
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
              <FieldLabel
                htmlFor={horizonValueId}
                tooltip="Período da simulação. Geralmente igual ao prazo do financiamento."
              >
                Horizonte
              </FieldLabel>
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
                    errors.horizonMonths
                      ? `${horizonValueId}-error`
                      : undefined
                  }
                  onChange={horizonRegister.onChange}
                  onBlur={horizonRegister.onBlur}
                  name={horizonRegister.name}
                  ref={horizonRegister.ref}
                />
                <Select
                  value={horizonUnit}
                  onValueChange={(value) => {
                    const next = value as HorizonUnit;
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
                >
                  <SelectTrigger
                    id={horizonUnitId}
                    aria-label="Unidade do horizonte"
                    className="w-32"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">meses</SelectItem>
                    <SelectItem value="years">anos</SelectItem>
                  </SelectContent>
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
        </TooltipProvider>

        {result &&
        finalBuyNetWorth !== null &&
        finalRentNetWorth !== null ? (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Vencedor:</span>
                <ScenarioBadge scenario={result.summary.bestScenario} />
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Patrimônio final (comprar)"
                  value={formatBRL(finalBuyNetWorth)}
                />
                <Metric
                  label="Patrimônio final (alugar + investir)"
                  value={formatBRL(finalRentNetWorth)}
                />
                <Metric
                  label="Diferença (R$)"
                  value={formatBRL(result.summary.netWorthDifferenceFinal)}
                />
                <Metric
                  label="Diferença (%)"
                  value={diferencaPctLabel ?? "—"}
                />
                <Metric
                  label="Mês de break-even"
                  value={
                    result.summary.breakEvenMonth === null
                      ? "Não atinge"
                      : `Mês ${result.summary.breakEvenMonth} · ${formatMonths(
                          result.summary.breakEvenMonth,
                        )}`
                  }
                  className="sm:col-span-2 lg:col-span-1"
                />
              </dl>
            </div>
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
