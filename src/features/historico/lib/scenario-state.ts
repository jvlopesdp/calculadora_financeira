import Decimal from "decimal.js";

import {
  type CurrentState,
  type FinancingScenario,
  type Payment,
  replayPayments,
} from "@/core/finance/replay-payments";
import { annualToMonthlyRate } from "@/core/finance/rent-vs-buy";
import type { PaymentApi, ScenarioApi } from "@/lib/api-client";

/**
 * Convert a `ScenarioApi` row (cents + basis points) into the Decimal-typed
 * `FinancingScenario` expected by the finance engine.
 */
export function rowToFinancingScenario(row: ScenarioApi): FinancingScenario {
  const principal = new Decimal(row.property_value_cents)
    .minus(row.down_payment_cents)
    .div(100);
  // basis points → percent fraction (e.g. 850 bp = 8.5% = 0.085).
  const annualRateFraction = new Decimal(row.annual_rate_basis_points).div(
    10_000,
  );
  const monthlyRate = annualToMonthlyRate(annualRateFraction);
  return {
    principal,
    monthlyRate,
    termMonths: row.term_months,
    startMonth: row.start_date.slice(0, 7),
  };
}

function isValidAmortizationStrategy(
  value: string,
): value is "prazo" | "parcela" {
  return value === "prazo" || value === "parcela";
}

export function rowToPayment(row: PaymentApi): Payment {
  return {
    referenceMonth: row.reference_month,
    amount: new Decimal(row.amount_paid_cents).div(100),
    strategy: isValidAmortizationStrategy(row.amortization_strategy)
      ? row.amortization_strategy
      : "prazo",
  };
}

/**
 * Compute the current state of a scenario from its API row + payment history.
 * Returns `replayPayments(...)` against the converted inputs.
 */
export function computeScenarioState(
  scenario: ScenarioApi,
  payments: PaymentApi[],
): CurrentState {
  const inputs = rowToFinancingScenario(scenario);
  return replayPayments(inputs, payments.map(rowToPayment));
}
