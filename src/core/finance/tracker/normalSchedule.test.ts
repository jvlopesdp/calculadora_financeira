import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { normalSchedule } from "./normalSchedule";

const ONE_CENT = new Decimal("0.01");

describe("normalSchedule", () => {
  describe("PRICE smoke (R$ 300.000 @ 0.8% mensal, 360 meses)", () => {
    const months = normalSchedule({
      principal: new Decimal(300000),
      monthlyRate: new Decimal("0.008"),
      termMonths: 360,
      modality: "PRICE",
    });

    it("produces one row per month with monthIndex", () => {
      expect(months).toHaveLength(360);
      expect(months[0]!.monthIndex).toBe(1);
      expect(months[359]!.monthIndex).toBe(360);
    });

    it("first row matches the golden fixture", () => {
      const first = months[0]!;
      expect(first.installment.toString()).toBe("2544.48");
      expect(first.interest.toString()).toBe("2400");
      expect(first.amortization.toString()).toBe("144.48");
      expect(first.balance.toString()).toBe("299855.52");
    });

    it("balance in the last month is zero (within R$ 0,01)", () => {
      const last = months[months.length - 1]!;
      expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
    });
  });

  describe("SAC smoke (R$ 300.000 @ 0.8% mensal, 360 meses)", () => {
    const months = normalSchedule({
      principal: new Decimal(300000),
      monthlyRate: new Decimal("0.008"),
      termMonths: 360,
      modality: "SAC",
    });

    it("produces one row per month", () => {
      expect(months).toHaveLength(360);
    });

    it("first row matches the golden fixture", () => {
      const first = months[0]!;
      expect(first.monthIndex).toBe(1);
      expect(first.installment.toString()).toBe("3233.33");
      expect(first.interest.toString()).toBe("2400");
      expect(first.amortization.toString()).toBe("833.33");
      expect(first.balance.toString()).toBe("299166.67");
    });

    it("balance in the last month is zero (within R$ 0,01)", () => {
      const last = months[months.length - 1]!;
      expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
    });
  });

  describe("term = 1 edge case", () => {
    it("PRICE emits a single row that pays off the loan", () => {
      const months = normalSchedule({
        principal: new Decimal(10000),
        monthlyRate: new Decimal("0.01"),
        termMonths: 1,
        modality: "PRICE",
      });
      expect(months).toHaveLength(1);
      const only = months[0]!;
      expect(only.monthIndex).toBe(1);
      expect(only.interest.equals(100)).toBe(true);
      expect(only.amortization.equals(10000)).toBe(true);
      expect(only.installment.equals(10100)).toBe(true);
      expect(only.balance.equals(0)).toBe(true);
    });

    it("SAC emits a single row that pays off the loan", () => {
      const months = normalSchedule({
        principal: new Decimal(10000),
        monthlyRate: new Decimal("0.01"),
        termMonths: 1,
        modality: "SAC",
      });
      expect(months).toHaveLength(1);
      const only = months[0]!;
      expect(only.balance.equals(0)).toBe(true);
    });
  });

  describe("balance is zero on the last month (tolerância 1 cent)", () => {
    const cases: Array<["PRICE" | "SAC", number, string, number]> = [
      ["PRICE", 200000, "0.0075", 240],
      ["PRICE", 500000, "0.009", 360],
      ["SAC", 200000, "0.0075", 240],
      ["SAC", 50000, "0.012", 60],
    ];

    for (const [modality, principal, rate, term] of cases) {
      it(`${modality} principal=${principal}, rate=${rate}, term=${term}`, () => {
        const months = normalSchedule({
          principal: new Decimal(principal),
          monthlyRate: new Decimal(rate),
          termMonths: term,
          modality,
        });
        expect(months).toHaveLength(term);
        const last = months[months.length - 1]!;
        expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
      });
    }
  });
});
