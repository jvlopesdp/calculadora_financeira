import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { generatePriceSchedule } from "./amortization";
import { roundMoney } from "./financial-types";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
} from "./prepayment";
import { calculatePriceInstallment } from "./price-calculator";
import { resolveExtraFromTargetPayment } from "./target-payment";

const PRINCIPAL = new Decimal(300000);
const MONTHLY_RATE = new Decimal("0.008");
const TERM_MONTHS = 360;

const BASE_PRICE_INSTALLMENT = roundMoney(
  calculatePriceInstallment({
    principal: PRINCIPAL,
    monthlyRate: MONTHLY_RATE,
    termMonths: TERM_MONTHS,
  }),
);

describe("resolveExtraFromTargetPayment", () => {
  it("returns extra = 0 and matches generatePriceSchedule when target equals the base PRICE installment", () => {
    const result = resolveExtraFromTargetPayment({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      targetMonthlyPayment: BASE_PRICE_INSTALLMENT,
    });

    const base = generatePriceSchedule({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      system: "PRICE",
    });

    expect(result.extraPayment.equals(0)).toBe(true);
    expect(result.schedule).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      const baseRow = base[i]!;
      const row = result.schedule[i]!;
      expect(row.month).toBe(baseRow.month);
      expect(row.installment.equals(baseRow.installment)).toBe(true);
      expect(row.interest.equals(baseRow.interest)).toBe(true);
      expect(row.amortization.equals(baseRow.amortization)).toBe(true);
      expect(row.balance.equals(baseRow.balance)).toBe(true);
      expect(row.extraPayment.equals(0)).toBe(true);
    }
    expect(result.summary.newTermMonths).toBe(TERM_MONTHS);
    expect(result.summary.monthsReduced).toBe(0);
  });

  it("with target > base under reduce-term, shortens the loan and records the implied extra", () => {
    const targetMonthlyPayment = BASE_PRICE_INSTALLMENT.plus(500);
    const result = resolveExtraFromTargetPayment({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      targetMonthlyPayment,
      strategy: "reduce-term",
    });

    expect(result.extraPayment.equals(500)).toBe(true);
    expect(result.summary.newTermMonths).toBeLessThan(TERM_MONTHS);
    expect(result.summary.interestSaved.greaterThan(0)).toBe(true);

    for (let i = 0; i < result.schedule.length - 1; i++) {
      expect(result.schedule[i]!.installment.equals(targetMonthlyPayment)).toBe(
        true,
      );
      expect(result.schedule[i]!.extraPayment.equals(500)).toBe(true);
    }
  });

  it("with target > base under reduce-installment, the term does not extend beyond the original", () => {
    const targetMonthlyPayment = BASE_PRICE_INSTALLMENT.plus(500);
    const result = resolveExtraFromTargetPayment({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      targetMonthlyPayment,
      strategy: "reduce-installment",
    });

    expect(result.extraPayment.equals(500)).toBe(true);
    expect(result.summary.newTermMonths).toBeLessThanOrEqual(TERM_MONTHS);
    expect(result.summary.interestSaved.greaterThan(0)).toBe(true);

    for (let i = 0; i < result.schedule.length - 1; i++) {
      expect(result.schedule[i]!.extraPayment.equals(500)).toBe(true);
    }
    for (let i = 1; i < result.schedule.length - 1; i++) {
      expect(
        result.schedule[i]!.installment.lessThanOrEqualTo(
          result.schedule[i - 1]!.installment,
        ),
      ).toBe(true);
    }
  });

  it("throws a pt-BR error when target < base PRICE installment", () => {
    const tooLow = BASE_PRICE_INSTALLMENT.minus(new Decimal("0.01"));
    expect(() =>
      resolveExtraFromTargetPayment({
        principal: PRINCIPAL,
        monthlyRate: MONTHLY_RATE,
        termMonths: TERM_MONTHS,
        targetMonthlyPayment: tooLow,
      }),
    ).toThrow(/Parcela desejada deve ser ≥ R\$/);
  });

  it("matches applyPrepaymentReduceTerm directly when fed the same implied extra", () => {
    const targetMonthlyPayment = BASE_PRICE_INSTALLMENT.plus(500);
    const result = resolveExtraFromTargetPayment({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      targetMonthlyPayment,
      strategy: "reduce-term",
    });

    const direct = applyPrepaymentReduceTerm(
      {
        principal: PRINCIPAL,
        monthlyRate: MONTHLY_RATE,
        termMonths: TERM_MONTHS,
        system: "PRICE",
      },
      result.extraPayment,
    );

    expect(result.schedule).toHaveLength(direct.schedule.length);
    for (let i = 0; i < direct.schedule.length; i++) {
      const a = direct.schedule[i]!;
      const b = result.schedule[i]!;
      expect(b.installment.equals(a.installment)).toBe(true);
      expect(b.interest.equals(a.interest)).toBe(true);
      expect(b.amortization.equals(a.amortization)).toBe(true);
      expect(b.balance.equals(a.balance)).toBe(true);
      expect(b.baseInstallment.equals(a.baseInstallment)).toBe(true);
      expect(b.extraPayment.equals(a.extraPayment)).toBe(true);
    }
    expect(
      result.summary.totalInterest.equals(direct.summary.totalInterest),
    ).toBe(true);
    expect(result.summary.newTermMonths).toBe(direct.summary.newTermMonths);
  });

  it("matches applyPrepaymentReduceInstallment directly when fed the same implied extra", () => {
    const targetMonthlyPayment = BASE_PRICE_INSTALLMENT.plus(500);
    const result = resolveExtraFromTargetPayment({
      principal: PRINCIPAL,
      monthlyRate: MONTHLY_RATE,
      termMonths: TERM_MONTHS,
      targetMonthlyPayment,
      strategy: "reduce-installment",
    });

    const direct = applyPrepaymentReduceInstallment(
      {
        principal: PRINCIPAL,
        monthlyRate: MONTHLY_RATE,
        termMonths: TERM_MONTHS,
        system: "PRICE",
      },
      result.extraPayment,
    );

    expect(result.schedule).toHaveLength(direct.schedule.length);
    for (let i = 0; i < direct.schedule.length; i++) {
      const a = direct.schedule[i]!;
      const b = result.schedule[i]!;
      expect(b.installment.equals(a.installment)).toBe(true);
      expect(b.interest.equals(a.interest)).toBe(true);
      expect(b.amortization.equals(a.amortization)).toBe(true);
      expect(b.balance.equals(a.balance)).toBe(true);
    }
  });
});
