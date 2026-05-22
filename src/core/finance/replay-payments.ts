import Decimal from "decimal.js";
import {
  type AmortizationSystem,
  type FinancingInputs,
  type ScheduleRow,
  roundMoney,
} from "./financial-types";
import { generatePriceSchedule, generateSacSchedule } from "./amortization";
import { calculatePriceInstallment } from "./price-calculator";
import { type PrepaymentScheduleRow } from "./prepayment";

export type AmortizationStrategy = "prazo" | "parcela";

export interface FinancingScenario {
  principal: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
  system?: AmortizationSystem;
  /** First scheduled installment month, ISO `YYYY-MM`. */
  startMonth: string;
}

export interface Payment {
  /** ISO `YYYY-MM` of the installment this payment covers. */
  referenceMonth: string;
  amount: Decimal;
  strategy: AmortizationStrategy;
}

export interface CurrentState {
  currentBalance: Decimal;
  remainingMonths: number;
  paidInterest: Decimal;
  paidPrincipal: Decimal;
  monthsAhead: number;
  nextScheduledPayment: Decimal;
  remainingSchedule: PrepaymentScheduleRow[];
  baselineSchedule: ScheduleRow[];
}

export interface ReplayOptions {
  /**
   * When a scheduled month has no payment, accrue interest on the balance.
   * Defaults to true (lender keeps charging interest on outstanding debt).
   */
  accrueOnMissingMonths?: boolean;
}

const ZERO = new Decimal(0);
const REFERENCE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateScenario(scenario: FinancingScenario): void {
  if (scenario.termMonths <= 0) {
    throw new Error("termMonths must be greater than zero");
  }
  if (scenario.principal.isNegative()) {
    throw new Error("principal must be non-negative");
  }
  if (scenario.monthlyRate.isNegative()) {
    throw new Error("monthlyRate must be non-negative");
  }
  if (!REFERENCE_MONTH_RE.test(scenario.startMonth)) {
    throw new Error("startMonth must be in YYYY-MM format");
  }
}

function monthIndex(startMonth: string, refMonth: string): number {
  if (!REFERENCE_MONTH_RE.test(refMonth)) {
    throw new Error(`referenceMonth must be in YYYY-MM format: ${refMonth}`);
  }
  const [sy, sm] = startMonth.split("-").map(Number) as [number, number];
  const [ry, rm] = refMonth.split("-").map(Number) as [number, number];
  return (ry - sy) * 12 + (rm - sm) + 1;
}

function buildBaseline(scenario: FinancingScenario): ScheduleRow[] {
  const inputs: FinancingInputs = {
    principal: scenario.principal,
    monthlyRate: scenario.monthlyRate,
    termMonths: scenario.termMonths,
  };
  return scenario.system === "SAC"
    ? generateSacSchedule(inputs)
    : generatePriceSchedule(inputs);
}

function buildContinuationPrice(
  balance: Decimal,
  monthlyRate: Decimal,
  priceInstallment: Decimal,
  monthsElapsed: number,
  termMonthsCap: number,
): PrepaymentScheduleRow[] {
  if (balance.lessThanOrEqualTo(ZERO)) return [];
  if (priceInstallment.lessThanOrEqualTo(ZERO)) return [];
  const rows: PrepaymentScheduleRow[] = [];
  let current = balance;
  let month = monthsElapsed + 1;
  while (current.greaterThan(ZERO) && rows.length < termMonthsCap) {
    const interest = roundMoney(current.times(monthlyRate));
    if (priceInstallment.lessThanOrEqualTo(interest)) {
      break;
    }
    const owed = current.plus(interest);
    let installment: Decimal;
    let amortization: Decimal;
    if (priceInstallment.greaterThanOrEqualTo(owed)) {
      installment = owed;
      amortization = current;
      current = ZERO;
    } else {
      installment = priceInstallment;
      amortization = installment.minus(interest);
      current = current.minus(amortization);
    }
    rows.push({
      month,
      installment,
      interest,
      amortization,
      balance: current,
      baseInstallment: installment,
      extraPayment: ZERO,
    });
    month += 1;
  }
  return rows;
}

function buildContinuationSac(
  balance: Decimal,
  monthlyRate: Decimal,
  sacBaseAmortization: Decimal,
  monthsElapsed: number,
  termMonthsCap: number,
): PrepaymentScheduleRow[] {
  if (balance.lessThanOrEqualTo(ZERO)) return [];
  if (sacBaseAmortization.lessThanOrEqualTo(ZERO)) return [];
  const rows: PrepaymentScheduleRow[] = [];
  let current = balance;
  let month = monthsElapsed + 1;
  while (current.greaterThan(ZERO) && rows.length < termMonthsCap) {
    const interest = roundMoney(current.times(monthlyRate));
    let amortization: Decimal;
    let installment: Decimal;
    if (sacBaseAmortization.greaterThanOrEqualTo(current)) {
      amortization = current;
      installment = roundMoney(amortization.plus(interest));
      current = ZERO;
    } else {
      amortization = sacBaseAmortization;
      installment = roundMoney(amortization.plus(interest));
      current = current.minus(amortization);
    }
    rows.push({
      month,
      installment,
      interest,
      amortization,
      balance: current,
      baseInstallment: installment,
      extraPayment: ZERO,
    });
    month += 1;
  }
  return rows;
}

function baselineMonthsToReach(
  balance: Decimal,
  baseline: ScheduleRow[],
): number {
  let count = 0;
  for (const row of baseline) {
    if (row.balance.greaterThanOrEqualTo(balance)) count++;
    else break;
  }
  return count;
}

/**
 * Replays a payment history against a financing scenario and returns the
 * current outstanding state plus the projected remaining schedule. Pure: does
 * not mutate inputs and returns fresh Decimals.
 *
 * Algorithm:
 *  - Walk month by month from `startMonth` through the last payment month.
 *  - For each month, compute the monthly interest on the running balance.
 *  - If the month has a payment:
 *      * `amount >= owed` (balance + interest): pays the loan off this month.
 *      * `amount >= baseInstallment`: counts as a completed installment, with
 *        any surplus reducing principal. The configured strategy ("parcela")
 *        recomputes the base installment for subsequent months; ("prazo")
 *        keeps the base installment constant so the loan ends earlier.
 *      * Otherwise: partial payment / delay — pays what it can; the shortfall
 *        accrues as interest on the remaining balance, and the installment is
 *        NOT considered completed (remaining term does not tick down).
 *  - If a month has no payment, balance accrues interest (toggleable).
 */
export function replayPayments(
  scenario: FinancingScenario,
  payments: Payment[],
  options: ReplayOptions = {},
): CurrentState {
  validateScenario(scenario);
  const accrueOnMissing = options.accrueOnMissingMonths ?? true;

  const baselineSchedule = buildBaseline(scenario);
  const system: AmortizationSystem = scenario.system ?? "PRICE";
  const isSac = system === "SAC";
  const { monthlyRate, termMonths } = scenario;

  const sorted = [...payments].sort((a, b) =>
    a.referenceMonth.localeCompare(b.referenceMonth),
  );

  const byMonth = new Map<number, Payment>();
  for (const p of sorted) {
    const idx = monthIndex(scenario.startMonth, p.referenceMonth);
    if (idx < 1) {
      throw new Error(
        `payment referenceMonth ${p.referenceMonth} is before startMonth ${scenario.startMonth}`,
      );
    }
    byMonth.set(idx, p);
  }

  const lastMonth =
    sorted.length === 0
      ? 0
      : monthIndex(
          scenario.startMonth,
          sorted[sorted.length - 1]!.referenceMonth,
        );

  let balance = roundMoney(scenario.principal);
  let remainingTerm = termMonths;
  let paidInterest = ZERO;
  let paidPrincipal = ZERO;

  let priceBaseInstallment = isSac
    ? ZERO
    : roundMoney(
        calculatePriceInstallment({
          principal: scenario.principal,
          monthlyRate,
          termMonths,
        }),
      );
  let sacBaseAmortization = isSac
    ? roundMoney(scenario.principal.div(termMonths))
    : ZERO;

  for (let m = 1; m <= lastMonth && balance.greaterThan(ZERO); m++) {
    const interest = roundMoney(balance.times(monthlyRate));
    const baseInstallment = isSac
      ? roundMoney(sacBaseAmortization.plus(interest))
      : priceBaseInstallment;

    const payment = byMonth.get(m);
    if (!payment) {
      if (accrueOnMissing) {
        balance = balance.plus(interest);
      }
      continue;
    }

    const amount = roundMoney(payment.amount);
    const owed = balance.plus(interest);

    if (amount.greaterThanOrEqualTo(owed)) {
      paidInterest = paidInterest.plus(interest);
      paidPrincipal = paidPrincipal.plus(balance);
      balance = ZERO;
      remainingTerm = 0;
      break;
    }

    if (amount.greaterThanOrEqualTo(interest)) {
      const principalPaid = amount.minus(interest);
      paidInterest = paidInterest.plus(interest);
      paidPrincipal = paidPrincipal.plus(principalPaid);
      balance = balance.minus(principalPaid);
    } else {
      paidInterest = paidInterest.plus(amount);
      balance = balance.plus(interest).minus(amount);
    }

    if (amount.greaterThanOrEqualTo(baseInstallment)) {
      remainingTerm -= 1;
      if (
        amount.greaterThan(baseInstallment) &&
        payment.strategy === "parcela" &&
        remainingTerm > 0
      ) {
        if (isSac) {
          sacBaseAmortization = roundMoney(balance.div(remainingTerm));
        } else {
          priceBaseInstallment = roundMoney(
            calculatePriceInstallment({
              principal: balance,
              monthlyRate,
              termMonths: remainingTerm,
            }),
          );
        }
      }
    }
  }

  const monthsElapsed = lastMonth;
  const balanceReachable = balance.isZero()
    ? termMonths
    : baselineMonthsToReach(balance, baselineSchedule);
  const monthsAhead = Math.max(0, balanceReachable - monthsElapsed);

  const remainingSchedule = isSac
    ? buildContinuationSac(
        balance,
        monthlyRate,
        sacBaseAmortization,
        monthsElapsed,
        termMonths * 2,
      )
    : buildContinuationPrice(
        balance,
        monthlyRate,
        priceBaseInstallment,
        monthsElapsed,
        termMonths * 2,
      );

  return {
    currentBalance: balance,
    remainingMonths: remainingSchedule.length,
    paidInterest,
    paidPrincipal,
    monthsAhead,
    nextScheduledPayment:
      remainingSchedule.length > 0 ? remainingSchedule[0]!.installment : ZERO,
    remainingSchedule,
    baselineSchedule,
  };
}
