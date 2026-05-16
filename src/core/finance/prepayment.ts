import Decimal from "decimal.js";
import {
  type AmortizationSystem,
  type FinancingInputs,
  type ScheduleRow,
  roundMoney,
} from "./financial-types";
import { generatePriceSchedule, generateSacSchedule } from "./amortization";
import { calculatePriceInstallment } from "./price-calculator";

export interface PrepaymentScheduleRow extends ScheduleRow {
  baseInstallment: Decimal;
  extraPayment: Decimal;
}

export interface PrepaymentSummary {
  totalPaid: Decimal;
  totalInterest: Decimal;
  interestSaved: Decimal;
  originalTermMonths: number;
  newTermMonths: number;
  monthsReduced: number;
}

export interface PrepaymentResult {
  schedule: PrepaymentScheduleRow[];
  summary: PrepaymentSummary;
}

const ZERO = new Decimal(0);

function systemOf(inputs: FinancingInputs): AmortizationSystem {
  return inputs.system ?? "PRICE";
}

function baseScheduleFor(inputs: FinancingInputs): ScheduleRow[] {
  return systemOf(inputs) === "SAC"
    ? generateSacSchedule(inputs)
    : generatePriceSchedule(inputs);
}

function totalInterestOf(schedule: ScheduleRow[]): Decimal {
  return schedule.reduce((acc, row) => acc.plus(row.interest), ZERO);
}

function buildSummary(
  schedule: PrepaymentScheduleRow[],
  originalTermMonths: number,
  baseInterest: Decimal,
): PrepaymentSummary {
  const totalPaid = schedule.reduce(
    (acc, row) => acc.plus(row.installment),
    ZERO,
  );
  const totalInterest = schedule.reduce(
    (acc, row) => acc.plus(row.interest),
    ZERO,
  );
  const newTermMonths = schedule.length;
  return {
    totalPaid,
    totalInterest,
    interestSaved: baseInterest.minus(totalInterest),
    originalTermMonths,
    newTermMonths,
    monthsReduced: originalTermMonths - newTermMonths,
  };
}

function validateInputs(inputs: FinancingInputs, extra: Decimal): void {
  if (inputs.termMonths <= 0) {
    throw new Error("termMonths must be greater than zero");
  }
  if (inputs.principal.isNegative()) {
    throw new Error("principal must be non-negative");
  }
  if (inputs.monthlyRate.isNegative()) {
    throw new Error("monthlyRate must be non-negative");
  }
  if (extra.isNegative()) {
    throw new Error("extraMonthly must be non-negative");
  }
}

function splitFinalPayment(
  installment: Decimal,
  rowBaseInstallment: Decimal,
  extraCap: Decimal,
): { baseInstallment: Decimal; extraPayment: Decimal } {
  const surplus = installment.minus(rowBaseInstallment);
  if (surplus.lessThanOrEqualTo(0)) {
    return { baseInstallment: installment, extraPayment: ZERO };
  }
  const extraPayment = Decimal.min(surplus, extraCap);
  return {
    baseInstallment: installment.minus(extraPayment),
    extraPayment,
  };
}

/**
 * Reduce-term: the borrower pays the original base installment plus a constant
 * extra each month. The installment shape (PRICE constant / SAC linear) is
 * preserved; the loan finishes earlier because the extra accelerates principal.
 */
export function applyPrepaymentReduceTerm(
  inputs: FinancingInputs,
  extraMonthly: Decimal,
): PrepaymentResult {
  const extra = roundMoney(extraMonthly);
  validateInputs(inputs, extra);

  const { principal, monthlyRate, termMonths } = inputs;
  const baseInterest = totalInterestOf(baseScheduleFor(inputs));

  if (principal.isZero()) {
    return { schedule: [], summary: buildSummary([], termMonths, baseInterest) };
  }

  const isSac = systemOf(inputs) === "SAC";
  const priceBaseInstallment = isSac
    ? ZERO
    : roundMoney(
        calculatePriceInstallment({ principal, monthlyRate, termMonths }),
      );
  const sacBaseAmortization = isSac
    ? roundMoney(principal.div(termMonths))
    : ZERO;

  const rows: PrepaymentScheduleRow[] = [];
  let balance = roundMoney(principal);

  for (let month = 1; month <= termMonths && balance.greaterThan(0); month++) {
    const interest = roundMoney(balance.times(monthlyRate));
    const rowBaseInstallment = isSac
      ? roundMoney(sacBaseAmortization.plus(interest))
      : priceBaseInstallment;
    const desiredTotal = roundMoney(rowBaseInstallment.plus(extra));
    const owed = balance.plus(interest);
    const isFinalMonth =
      month === termMonths || desiredTotal.greaterThanOrEqualTo(owed);

    let installment: Decimal;
    let amortization: Decimal;
    let baseInstallment: Decimal;
    let extraPayment: Decimal;

    if (isFinalMonth) {
      installment = owed;
      amortization = balance;
      ({ baseInstallment, extraPayment } = splitFinalPayment(
        installment,
        rowBaseInstallment,
        extra,
      ));
      balance = ZERO;
    } else {
      installment = desiredTotal;
      amortization = installment.minus(interest);
      baseInstallment = rowBaseInstallment;
      extraPayment = extra;
      balance = balance.minus(amortization);
    }

    rows.push({
      month,
      installment,
      interest,
      amortization,
      balance,
      baseInstallment,
      extraPayment,
    });
  }

  return {
    schedule: rows,
    summary: buildSummary(rows, termMonths, baseInterest),
  };
}

/**
 * Reduce-installment: each month the bank recomputes the installment so that
 * the remaining balance amortizes over the remaining original term. The borrower
 * pays the recomputed installment plus the configured extra; the extra
 * accelerates principal reduction so the stated installment shrinks month over
 * month. With recurring extras the loan can still finish earlier than the
 * original term — the term is "fixed" in the recalculation rule, not in the
 * outcome.
 */
export function applyPrepaymentReduceInstallment(
  inputs: FinancingInputs,
  extraMonthly: Decimal,
): PrepaymentResult {
  const extra = roundMoney(extraMonthly);
  validateInputs(inputs, extra);

  const { principal, monthlyRate, termMonths } = inputs;
  const baseInterest = totalInterestOf(baseScheduleFor(inputs));

  if (principal.isZero()) {
    return { schedule: [], summary: buildSummary([], termMonths, baseInterest) };
  }

  // With no extra, the recursive PRICE/SAC recalculation reduces to the base
  // schedule in continuous math; rounding drift can desync by cents, so we
  // short-circuit to guarantee an exact passthrough.
  if (extra.isZero()) {
    const baseSchedule = baseScheduleFor(inputs);
    const rows: PrepaymentScheduleRow[] = baseSchedule.map((row) => ({
      ...row,
      baseInstallment: row.installment,
      extraPayment: ZERO,
    }));
    return {
      schedule: rows,
      summary: buildSummary(rows, termMonths, baseInterest),
    };
  }

  const isSac = systemOf(inputs) === "SAC";
  const rows: PrepaymentScheduleRow[] = [];
  let balance = roundMoney(principal);
  let remainingTerm = termMonths;

  for (let month = 1; month <= termMonths && balance.greaterThan(0); month++) {
    const interest = roundMoney(balance.times(monthlyRate));
    let rowBaseInstallment: Decimal;
    if (isSac) {
      const currentBaseAmortization = roundMoney(balance.div(remainingTerm));
      rowBaseInstallment = roundMoney(currentBaseAmortization.plus(interest));
    } else {
      rowBaseInstallment = roundMoney(
        calculatePriceInstallment({
          principal: balance,
          monthlyRate,
          termMonths: remainingTerm,
        }),
      );
    }

    const desiredTotal = roundMoney(rowBaseInstallment.plus(extra));
    const owed = balance.plus(interest);
    const isFinalMonth =
      remainingTerm === 1 ||
      month === termMonths ||
      desiredTotal.greaterThanOrEqualTo(owed);

    let installment: Decimal;
    let amortization: Decimal;
    let baseInstallment: Decimal;
    let extraPayment: Decimal;

    if (isFinalMonth) {
      installment = owed;
      amortization = balance;
      ({ baseInstallment, extraPayment } = splitFinalPayment(
        installment,
        rowBaseInstallment,
        extra,
      ));
      balance = ZERO;
    } else {
      installment = desiredTotal;
      amortization = installment.minus(interest);
      baseInstallment = rowBaseInstallment;
      extraPayment = extra;
      balance = balance.minus(amortization);
    }

    rows.push({
      month,
      installment,
      interest,
      amortization,
      balance,
      baseInstallment,
      extraPayment,
    });
    remainingTerm -= 1;
  }

  return {
    schedule: rows,
    summary: buildSummary(rows, termMonths, baseInterest),
  };
}
