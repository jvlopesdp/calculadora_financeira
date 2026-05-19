import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { calculatePriceInstallment } from "./price-calculator";

describe("calculatePriceInstallment", () => {
  it("computes the standard 360-month case (golden fixture)", () => {
    const installment = calculatePriceInstallment({
      principal: new Decimal(300000),
      monthlyRate: new Decimal("0.008"),
      termMonths: 360,
    });
    expect(installment.toDecimalPlaces(2).toString()).toBe("2544.48");
  });

  it("returns principal/term when the monthly rate is zero", () => {
    const installment = calculatePriceInstallment({
      principal: new Decimal(12000),
      monthlyRate: new Decimal(0),
      termMonths: 12,
    });
    expect(installment.equals(1000)).toBe(true);
  });

  it("for a 1-month term returns principal * (1 + rate)", () => {
    const installment = calculatePriceInstallment({
      principal: new Decimal(10000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 1,
    });
    expect(installment.equals(10100)).toBe(true);
  });

  it("throws when termMonths is zero", () => {
    expect(() =>
      calculatePriceInstallment({
        principal: new Decimal(1000),
        monthlyRate: new Decimal("0.01"),
        termMonths: 0,
      }),
    ).toThrow();
  });

  it("throws when termMonths is negative", () => {
    expect(() =>
      calculatePriceInstallment({
        principal: new Decimal(1000),
        monthlyRate: new Decimal("0.01"),
        termMonths: -1,
      }),
    ).toThrow();
  });

  it("throws when monthlyRate is negative", () => {
    expect(() =>
      calculatePriceInstallment({
        principal: new Decimal(1000),
        monthlyRate: new Decimal("-0.01"),
        termMonths: 12,
      }),
    ).toThrow();
  });

  it("throws when principal is negative", () => {
    expect(() =>
      calculatePriceInstallment({
        principal: new Decimal(-1000),
        monthlyRate: new Decimal("0.01"),
        termMonths: 12,
      }),
    ).toThrow();
  });
});
