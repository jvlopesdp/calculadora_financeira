import Decimal from "decimal.js";

import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  type FinancingInputs,
  type ScheduleRow,
} from "@/core/finance/financial-types";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

export const INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE =
  "Preencha os dados de financiamento para visualizar a composição das parcelas.";

export interface InstallmentCompositionChartPoint {
  month: number;
  juros: number;
  amortizacao: number;
  total: number;
}

function buildFinancingInputs(values: FinancingFormValues): FinancingInputs {
  return {
    principal: new Decimal(values.propertyValue).minus(values.downPayment),
    monthlyRate: new Decimal(values.monthlyRate).div(100),
    termMonths: values.termMonths,
    system: values.system,
  };
}

function baseScheduleFor(inputs: FinancingInputs): ScheduleRow[] {
  return inputs.system === "SAC"
    ? generateSacSchedule(inputs)
    : generatePriceSchedule(inputs);
}

export function prepareInstallmentCompositionData(
  financing: FinancingFormValues | null,
): InstallmentCompositionChartPoint[] | null {
  if (!financing) return null;
  try {
    const inputs = buildFinancingInputs(financing);
    const schedule = baseScheduleFor(inputs);
    if (schedule.length === 0) return null;
    return schedule.map((row) => {
      const juros = row.interest.toNumber();
      const amortizacao = row.amortization.toNumber();
      return {
        month: row.month,
        juros,
        amortizacao,
        total: juros + amortizacao,
      };
    });
  } catch {
    return null;
  }
}
