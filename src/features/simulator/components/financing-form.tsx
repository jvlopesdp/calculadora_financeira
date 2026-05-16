import { useEffect, useId, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { PercentageInput } from "@/components/finance/percentage-input";
import { formatBRL } from "@/lib/formatters/currency";
import { formatPercentage } from "@/lib/formatters/percentage";
import {
  financingSchema,
  type FinancingFormValues,
} from "@/features/simulator/schemas/financing";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";

type FormShape = {
  propertyValue: number | null;
  downPayment: number | null;
  monthlyRate: number | null;
  termMonths: number | null;
  system: "PRICE" | "SAC";
};

const defaultValues: FormShape = {
  propertyValue: null,
  downPayment: null,
  monthlyRate: null,
  termMonths: null,
  system: "PRICE",
};

function toEquivalentAnnualRate(monthlyRate: number): number {
  return (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
}

export function FinancingForm() {
  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isValid },
  } = useForm<FormShape>({
    resolver: zodResolver(financingSchema),
    mode: "onChange",
    defaultValues,
  });

  const watched = useWatch({ control });
  const { setFinancing } = useSimulation();

  const financedAmount = useMemo(() => {
    const propertyValue = watched.propertyValue;
    const downPayment = watched.downPayment;
    if (
      typeof propertyValue !== "number" ||
      typeof downPayment !== "number" ||
      !Number.isFinite(propertyValue) ||
      !Number.isFinite(downPayment)
    ) {
      return null;
    }
    if (downPayment >= propertyValue) return null;
    return propertyValue - downPayment;
  }, [watched.propertyValue, watched.downPayment]);

  const equivalentAnnualRate = useMemo(() => {
    const monthlyRate = watched.monthlyRate;
    if (typeof monthlyRate !== "number" || monthlyRate <= 0) return null;
    return toEquivalentAnnualRate(monthlyRate);
  }, [watched.monthlyRate]);

  const propertyValueId = useId();
  const downPaymentId = useId();
  const financedAmountId = useId();
  const monthlyRateId = useId();
  const annualRateId = useId();
  const termMonthsId = useId();
  const systemId = useId();

  const termRegister = register("termMonths", {
    setValueAs: (raw) => {
      if (raw === "" || raw === null || raw === undefined) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    },
  });

  useEffect(() => {
    if (!isValid) {
      setFinancing(null);
    }
  }, [isValid, setFinancing]);

  const onSubmit = handleSubmit((values) => {
    setFinancing(values as unknown as FinancingFormValues);
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      aria-label="Formulário de financiamento"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={propertyValueId}>Valor do imóvel</Label>
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
        <Label htmlFor={downPaymentId}>Entrada</Label>
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
        <Label htmlFor={financedAmountId}>Valor financiado</Label>
        <output
          id={financedAmountId}
          className="border-input bg-muted text-muted-foreground font-tabular flex h-9 w-full items-center rounded-md border px-3 text-sm"
          aria-live="polite"
        >
          {financedAmount === null ? "—" : formatBRL(financedAmount)}
        </output>
        <p className="text-muted-foreground text-xs">
          Calculado a partir do valor do imóvel e da entrada.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={monthlyRateId}>Taxa mensal</Label>
        <Controller
          control={control}
          name="monthlyRate"
          render={({ field, fieldState }) => (
            <PercentageInput
              id={monthlyRateId}
              value={field.value ?? null}
              onChange={field.onChange}
              onBlur={field.onBlur}
              decimals={4}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={
                fieldState.error ? `${monthlyRateId}-error` : undefined
              }
            />
          )}
        />
        {errors.monthlyRate?.message ? (
          <p
            id={`${monthlyRateId}-error`}
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.monthlyRate.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={annualRateId}>Taxa anual equivalente</Label>
        <output
          id={annualRateId}
          className="border-input bg-muted text-muted-foreground font-tabular flex h-9 w-full items-center rounded-md border px-3 text-sm"
          aria-live="polite"
        >
          {equivalentAnnualRate === null
            ? "—"
            : formatPercentage(equivalentAnnualRate, 4)}
        </output>
        <p className="text-muted-foreground text-xs">
          (1 + taxa mensal)<sup>12</sup> − 1
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={termMonthsId}>Prazo em meses</Label>
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

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor={systemId}>Sistema de amortização</Label>
        <Select
          id={systemId}
          aria-invalid={errors.system ? true : undefined}
          aria-describedby={errors.system ? `${systemId}-error` : undefined}
          {...register("system")}
        >
          <option value="PRICE">PRICE (parcelas fixas)</option>
          <option value="SAC">SAC (amortização constante)</option>
        </Select>
        {errors.system?.message ? (
          <p
            id={`${systemId}-error`}
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.system.message}
          </p>
        ) : null}
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={!isValid} className="w-full md:w-auto">
          Simular
        </Button>
      </div>
    </form>
  );
}
