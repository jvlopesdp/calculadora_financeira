import Decimal from "decimal.js";

import {
  type CurrentState,
  type FinancingScenario,
  type Payment,
  replayPayments,
} from "@/core/finance/replay-payments";
import type { PaymentApi, ScenarioApi } from "@/lib/api-client";

import { rowToFinancingScenario, rowToPayment } from "./scenario-state";

const ZERO = new Decimal(0);

export type SimulationStrategy = "prazo" | "parcela";

export interface SimulationInputs {
  scenario: ScenarioApi;
  payments: PaymentApi[];
  /** BRL value of the hypothetical payment (total for the next month). */
  amountBRL: number;
  strategy: SimulationStrategy;
}

export interface SimulationResult {
  referenceMonth: string;
  baseInstallment: Decimal;
  hypothetical: CurrentState;
  baseOnly: CurrentState;
  /** Hypothetical balance minus base-only balance (negative = hypothetical paid down more). */
  deltaBalance: Decimal;
  /** Hypothetical remaining months minus base-only remaining months (negative = months saved). */
  deltaRemainingMonths: number;
  /** Base-only total interest minus hypothetical total interest (positive = savings). */
  interestSavings: Decimal;
}

function addMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + 1;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

export function nextReferenceMonth(
  scenario: ScenarioApi,
  payments: PaymentApi[],
): string {
  if (payments.length === 0) return scenario.start_date.slice(0, 7);
  let latest = payments[0]!.reference_month;
  for (const p of payments) {
    if (p.reference_month.localeCompare(latest) > 0) latest = p.reference_month;
  }
  return addMonth(latest);
}

function totalInterest(state: CurrentState): Decimal {
  return state.paidInterest.plus(
    state.remainingSchedule.reduce((acc, row) => acc.plus(row.interest), ZERO),
  );
}

/**
 * Run a what-if simulation against the scenario's payment history. Returns the
 * hypothetical end state plus deltas against paying only the base installment
 * for the next month. Pure: does not mutate inputs. Returns `null` when the
 * hypothetical amount is not a positive finite number.
 */
export function buildSimulation(
  inputs: SimulationInputs,
): SimulationResult | null {
  const { scenario, payments, amountBRL, strategy } = inputs;
  if (!Number.isFinite(amountBRL) || amountBRL <= 0) return null;

  const finScenario: FinancingScenario = rowToFinancingScenario(scenario);
  const realPayments: Payment[] = payments.map(rowToPayment);

  const currentState = replayPayments(finScenario, realPayments);
  const baseInstallment = currentState.nextScheduledPayment;
  const refMonth = nextReferenceMonth(scenario, payments);

  const hypoPayment: Payment = {
    referenceMonth: refMonth,
    amount: new Decimal(amountBRL),
    strategy,
  };
  const basePayment: Payment = {
    referenceMonth: refMonth,
    amount: baseInstallment,
    strategy: "prazo",
  };

  const hypothetical = replayPayments(finScenario, [
    ...realPayments,
    hypoPayment,
  ]);
  const baseOnly = replayPayments(finScenario, [...realPayments, basePayment]);

  const deltaBalance = hypothetical.currentBalance.minus(
    baseOnly.currentBalance,
  );
  const deltaRemainingMonths =
    hypothetical.remainingMonths - baseOnly.remainingMonths;
  const interestSavings = totalInterest(baseOnly).minus(
    totalInterest(hypothetical),
  );

  return {
    referenceMonth: refMonth,
    baseInstallment,
    hypothetical,
    baseOnly,
    deltaBalance,
    deltaRemainingMonths,
    interestSavings,
  };
}
