import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { generatePriceSchedule } from "./amortization";
import { roundMoney } from "./financial-types";
import {
  type FinancingScenario,
  type Payment,
  replayPayments,
} from "./replay-payments";

const ONE_CENT = new Decimal("0.01");

const STANDARD_SCENARIO: FinancingScenario = {
  principal: new Decimal(300000),
  monthlyRate: new Decimal("0.008"),
  termMonths: 360,
  system: "PRICE",
  startMonth: "2026-01",
};

function refMonth(start: string, offset: number): string {
  const [y, m] = start.split("-").map(Number) as [number, number];
  const total = (y * 12 + (m - 1)) + offset;
  const ry = Math.floor(total / 12);
  const rm = (total % 12) + 1;
  return `${ry}-${String(rm).padStart(2, "0")}`;
}

function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0));
}

describe("replayPayments", () => {
  it("case 1: exact installments only — balance matches baseline at last paid month", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = Array.from({ length: 12 }, (_, i) => ({
      referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, i),
      amount: baseInstallment,
      strategy: "prazo",
    }));

    const state = replayPayments(STANDARD_SCENARIO, payments);

    expect(state.currentBalance.minus(baseline[11]!.balance).abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
    expect(state.remainingMonths).toBe(360 - 12);
    expect(state.monthsAhead).toBe(0);
    expect(state.nextScheduledPayment.greaterThan(0)).toBe(true);
  });

  it("case 2: extra reduce-term — loan ends earlier than baseline, installment preserved", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = Array.from({ length: 24 }, (_, i) => ({
      referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, i),
      amount: baseInstallment.plus(500),
      strategy: "prazo",
    }));

    const state = replayPayments(STANDARD_SCENARIO, payments);

    expect(state.currentBalance.lessThan(baseline[23]!.balance)).toBe(true);
    expect(state.monthsAhead).toBeGreaterThan(0);
    expect(state.paidPrincipal.greaterThan(0)).toBe(true);
    expect(state.remainingMonths).toBeLessThan(360 - 24);
    expect(state.nextScheduledPayment.equals(baseInstallment)).toBe(true);
  });

  it("case 3: extra reduce-installment — recomputed next payment shrinks over original term", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = Array.from({ length: 12 }, (_, i) => ({
      referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, i),
      amount: baseInstallment.plus(1000),
      strategy: "parcela",
    }));

    const state = replayPayments(STANDARD_SCENARIO, payments);

    expect(state.nextScheduledPayment.lessThan(baseInstallment)).toBe(true);
    expect(Math.abs(state.remainingMonths - (360 - 12))).toBeLessThanOrEqual(2);
    expect(state.monthsAhead).toBeGreaterThan(0);
  });

  it("case 4: mixed sequence of base, prazo and parcela extras", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = [
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 0), amount: baseInstallment, strategy: "prazo" },
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 1), amount: baseInstallment.plus(2000), strategy: "prazo" },
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 2), amount: baseInstallment.plus(1000), strategy: "parcela" },
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 3), amount: baseInstallment, strategy: "prazo" },
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 4), amount: baseInstallment.plus(500), strategy: "prazo" },
    ];

    const state = replayPayments(STANDARD_SCENARIO, payments);

    expect(state.currentBalance.lessThan(baseline[4]!.balance)).toBe(true);
    expect(state.paidPrincipal.plus(state.currentBalance).minus(STANDARD_SCENARIO.principal).abs().lessThanOrEqualTo(new Decimal("1"))).toBe(true);
    expect(state.monthsAhead).toBeGreaterThan(0);
    expect(state.remainingSchedule.length).toBeGreaterThan(0);
  });

  it("case 5: no payments returns the initial state (full baseline schedule remains)", () => {
    const state = replayPayments(STANDARD_SCENARIO, []);
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);

    expect(state.currentBalance.equals(roundMoney(STANDARD_SCENARIO.principal))).toBe(true);
    expect(state.remainingMonths).toBe(360);
    expect(state.paidInterest.equals(0)).toBe(true);
    expect(state.paidPrincipal.equals(0)).toBe(true);
    expect(state.monthsAhead).toBe(0);
    expect(state.nextScheduledPayment.equals(baseline[0]!.installment)).toBe(true);
  });

  it("case 6: a single overpayment settles the balance", () => {
    const small: FinancingScenario = {
      principal: new Decimal(1000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 12,
      system: "PRICE",
      startMonth: "2026-01",
    };
    const payments: Payment[] = [
      { referenceMonth: "2026-01", amount: new Decimal(1010), strategy: "prazo" },
    ];

    const state = replayPayments(small, payments);

    expect(state.currentBalance.equals(0)).toBe(true);
    expect(state.remainingMonths).toBe(0);
    expect(state.paidPrincipal.equals(1000)).toBe(true);
    expect(state.paidInterest.equals(10)).toBe(true);
    expect(state.remainingSchedule).toHaveLength(0);
    expect(state.nextScheduledPayment.equals(0)).toBe(true);
  });

  it("case 7: payment larger than final owed clamps balance to zero (no negative)", () => {
    const small: FinancingScenario = {
      principal: new Decimal(1000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 12,
      system: "PRICE",
      startMonth: "2026-01",
    };
    const payments: Payment[] = [
      { referenceMonth: "2026-01", amount: new Decimal(50000), strategy: "prazo" },
    ];

    const state = replayPayments(small, payments);

    expect(state.currentBalance.equals(0)).toBe(true);
    expect(state.currentBalance.isNegative()).toBe(false);
    expect(state.paidPrincipal.equals(1000)).toBe(true);
    expect(state.paidInterest.equals(10)).toBe(true);
  });

  it("case 8: partial payment is treated as a delay (term does not tick down, balance grows)", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const partial = roundMoney(baseInstallment.div(2));
    const payments: Payment[] = [
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 0), amount: partial, strategy: "prazo" },
    ];

    const state = replayPayments(STANDARD_SCENARIO, payments);

    expect(state.currentBalance.greaterThan(baseline[0]!.balance)).toBe(true);
    // A partial payment leaves the user behind: the original installment
    // amortizes a larger remaining balance, so it takes MORE months than the
    // original term to clear (no early termination).
    expect(state.remainingMonths).toBeGreaterThan(360 - 1);
    expect(state.monthsAhead).toBe(0);
  });

  it("case 9: skipped month accrues interest on balance", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = [
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 0), amount: baseInstallment, strategy: "prazo" },
      // month 2 skipped
      { referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, 2), amount: baseInstallment, strategy: "prazo" },
    ];

    const accrued = replayPayments(STANDARD_SCENARIO, payments);
    const noAccrual = replayPayments(STANDARD_SCENARIO, payments, {
      accrueOnMissingMonths: false,
    });

    expect(accrued.currentBalance.greaterThan(noAccrual.currentBalance)).toBe(true);
  });

  it("case 10: stable snapshot — same input yields the same output", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = Array.from({ length: 6 }, (_, i) => ({
      referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, i),
      amount: baseInstallment.plus(300),
      strategy: i % 2 === 0 ? "prazo" : "parcela",
    }));

    const a = replayPayments(STANDARD_SCENARIO, payments);
    const b = replayPayments(STANDARD_SCENARIO, payments);

    expect(a.currentBalance.equals(b.currentBalance)).toBe(true);
    expect(a.paidInterest.equals(b.paidInterest)).toBe(true);
    expect(a.paidPrincipal.equals(b.paidPrincipal)).toBe(true);
    expect(a.remainingMonths).toBe(b.remainingMonths);
    expect(a.monthsAhead).toBe(b.monthsAhead);
    expect(a.nextScheduledPayment.equals(b.nextScheduledPayment)).toBe(true);
    expect(a.remainingSchedule.length).toBe(b.remainingSchedule.length);
    for (let i = 0; i < a.remainingSchedule.length; i++) {
      expect(a.remainingSchedule[i]!.installment.equals(b.remainingSchedule[i]!.installment)).toBe(true);
      expect(a.remainingSchedule[i]!.balance.equals(b.remainingSchedule[i]!.balance)).toBe(true);
    }
  });

  it("case 11: baselineSchedule does not depend on payment history", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const a = replayPayments(STANDARD_SCENARIO, []);
    const b = replayPayments(STANDARD_SCENARIO, [
      { referenceMonth: "2026-01", amount: baseInstallment.plus(5000), strategy: "parcela" },
      { referenceMonth: "2026-02", amount: baseInstallment.plus(5000), strategy: "prazo" },
    ]);

    expect(a.baselineSchedule.length).toBe(b.baselineSchedule.length);
    for (let i = 0; i < a.baselineSchedule.length; i++) {
      expect(a.baselineSchedule[i]!.installment.equals(b.baselineSchedule[i]!.installment)).toBe(true);
      expect(a.baselineSchedule[i]!.interest.equals(b.baselineSchedule[i]!.interest)).toBe(true);
      expect(a.baselineSchedule[i]!.balance.equals(b.baselineSchedule[i]!.balance)).toBe(true);
    }
  });

  it("case 12: extras with reduce-term save interest vs baseline", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const payments: Payment[] = Array.from({ length: 36 }, (_, i) => ({
      referenceMonth: refMonth(STANDARD_SCENARIO.startMonth, i),
      amount: baseInstallment.plus(1000),
      strategy: "prazo",
    }));

    const state = replayPayments(STANDARD_SCENARIO, payments);
    const baselineInterest = sumDecimals(baseline.map((r) => r.interest));
    const remainingInterest = sumDecimals(
      state.remainingSchedule.map((r) => r.interest),
    );
    const actualInterest = state.paidInterest.plus(remainingInterest);
    const economy = baselineInterest.minus(actualInterest);

    expect(economy.greaterThan(0)).toBe(true);
  });

  it("does not mutate the input scenario or payment list", () => {
    const baseline = generatePriceSchedule(STANDARD_SCENARIO);
    const baseInstallment = baseline[0]!.installment;
    const scenarioCopy: FinancingScenario = { ...STANDARD_SCENARIO };
    const payments: Payment[] = [
      { referenceMonth: "2026-01", amount: baseInstallment.plus(500), strategy: "parcela" },
    ];
    const paymentsBefore = JSON.stringify(payments);

    replayPayments(scenarioCopy, payments);

    expect(JSON.stringify(payments)).toBe(paymentsBefore);
    expect(scenarioCopy.principal.equals(STANDARD_SCENARIO.principal)).toBe(true);
    expect(scenarioCopy.termMonths).toBe(STANDARD_SCENARIO.termMonths);
  });

  it("validates startMonth and reference month formats", () => {
    expect(() =>
      replayPayments({ ...STANDARD_SCENARIO, startMonth: "2026-1" }, []),
    ).toThrow(/YYYY-MM/);
    expect(() =>
      replayPayments(STANDARD_SCENARIO, [
        { referenceMonth: "2026/01", amount: new Decimal(100), strategy: "prazo" },
      ]),
    ).toThrow(/YYYY-MM/);
    expect(() =>
      replayPayments(STANDARD_SCENARIO, [
        {
          referenceMonth: "2025-12",
          amount: new Decimal(100),
          strategy: "prazo",
        },
      ]),
    ).toThrow(/before startMonth/);
  });
});
