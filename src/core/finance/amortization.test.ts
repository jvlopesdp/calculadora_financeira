import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { generatePriceSchedule } from "./amortization";
import { summarizeSchedule } from "./financial-types";

const ONE_CENT = new Decimal("0.01");

describe("generatePriceSchedule", () => {
  describe("standard 360-month case (R$ 300.000 @ 0.8% mensal)", () => {
    const schedule = generatePriceSchedule({
      principal: new Decimal(300000),
      monthlyRate: new Decimal("0.008"),
      termMonths: 360,
    });

    it("produces one row per month", () => {
      expect(schedule).toHaveLength(360);
    });

    it("first row matches the golden fixture", () => {
      const first = schedule[0]!;
      expect(first.month).toBe(1);
      expect(first.installment.toString()).toBe("2544.48");
      expect(first.interest.toString()).toBe("2400");
      expect(first.amortization.toString()).toBe("144.48");
      expect(first.balance.toString()).toBe("299855.52");
    });

    it("final balance is exactly zero (within R$ 0,01)", () => {
      const last = schedule[schedule.length - 1]!;
      expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
      expect(last.balance.toString()).toBe("0");
    });

    it("interest + amortization equals installment for every row", () => {
      for (const row of schedule) {
        const sum = row.interest.plus(row.amortization);
        expect(sum.equals(row.installment)).toBe(true);
      }
    });

    it("balance decreases monotonically", () => {
      let prev = new Decimal(300000);
      for (const row of schedule) {
        expect(row.balance.lessThan(prev)).toBe(true);
        prev = row.balance;
      }
    });

    it("total amortization equals principal", () => {
      const total = schedule.reduce(
        (acc, row) => acc.plus(row.amortization),
        new Decimal(0),
      );
      expect(total.equals(300000)).toBe(true);
    });

    it("the final installment absorbs any rounding residual", () => {
      const last = schedule[schedule.length - 1]!;
      const baseInstallment = schedule[0]!.installment;
      const delta = last.installment.minus(baseInstallment).abs();
      expect(delta.lessThan(baseInstallment)).toBe(true);
    });
  });

  describe("zero-rate edge case", () => {
    const schedule = generatePriceSchedule({
      principal: new Decimal(12000),
      monthlyRate: new Decimal(0),
      termMonths: 12,
    });

    it("emits 12 fixed installments of R$ 1.000", () => {
      expect(schedule).toHaveLength(12);
      for (const row of schedule) {
        expect(row.installment.equals(1000)).toBe(true);
        expect(row.interest.equals(0)).toBe(true);
        expect(row.amortization.equals(1000)).toBe(true);
      }
    });

    it("ends with a zero balance", () => {
      expect(schedule[schedule.length - 1]!.balance.equals(0)).toBe(true);
    });
  });

  describe("1-month edge case", () => {
    const schedule = generatePriceSchedule({
      principal: new Decimal(10000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 1,
    });

    it("emits a single row that pays off the loan", () => {
      expect(schedule).toHaveLength(1);
      const only = schedule[0]!;
      expect(only.interest.equals(100)).toBe(true);
      expect(only.amortization.equals(10000)).toBe(true);
      expect(only.installment.equals(10100)).toBe(true);
      expect(only.balance.equals(0)).toBe(true);
    });
  });

  describe("balance-zero invariant under varied parameters", () => {
    const cases: Array<[number, string, number]> = [
      [200000, "0.0075", 240],
      [500000, "0.009", 360],
      [50000, "0.012", 60],
      [1000000, "0.0083", 420],
    ];

    for (const [principal, rate, term] of cases) {
      it(`pays balance to zero for principal=${principal}, rate=${rate}, term=${term}`, () => {
        const schedule = generatePriceSchedule({
          principal: new Decimal(principal),
          monthlyRate: new Decimal(rate),
          termMonths: term,
        });
        expect(schedule).toHaveLength(term);
        const last = schedule[schedule.length - 1]!;
        expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
      });
    }
  });

  it("returns an empty schedule when termMonths is zero", () => {
    const schedule = generatePriceSchedule({
      principal: new Decimal(1000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 0,
    });
    expect(schedule).toHaveLength(0);
  });
});

describe("summarizeSchedule", () => {
  it("aggregates totals from a generated schedule", () => {
    const schedule = generatePriceSchedule({
      principal: new Decimal(10000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 1,
    });
    const summary = summarizeSchedule(schedule, 1);
    expect(summary.totalPaid.equals(10100)).toBe(true);
    expect(summary.totalInterest.equals(100)).toBe(true);
    expect(summary.totalAmortization.equals(10000)).toBe(true);
    expect(summary.termMonths).toBe(1);
  });
});
