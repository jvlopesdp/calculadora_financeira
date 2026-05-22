import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { generatePriceSchedule } from "@/core/finance/amortization";
import { calculatePriceInstallment } from "@/core/finance/price-calculator";
import {
  type FinancingScenario,
  type Payment,
  replayPayments,
} from "@/core/finance/replay-payments";

import {
  prepareScenarioBalanceData,
  prepareScenarioInterestData,
  summarizeScenarioSavings,
} from "./build-detail-chart-data";

const SCENARIO: FinancingScenario = {
  principal: new Decimal(300_000),
  monthlyRate: new Decimal("0.008"),
  termMonths: 360,
  system: "PRICE",
  startMonth: "2026-01",
};

function refMonth(start: string, offset: number): string {
  const [y, m] = start.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + offset;
  const ry = Math.floor(total / 12);
  const rm = (total % 12) + 1;
  return `${ry}-${String(rm).padStart(2, "0")}`;
}

describe("prepareScenarioBalanceData", () => {
  it("returns month 0 with the initial principal for both series", () => {
    const state = replayPayments(SCENARIO, []);
    const data = prepareScenarioBalanceData(SCENARIO.principal, state);
    expect(data[0]).toEqual({
      month: 0,
      saldoPrevisto: 300_000,
      saldoReal: 300_000,
    });
  });

  it("matches the baseline schedule when no payments are registered", () => {
    const state = replayPayments(SCENARIO, []);
    const data = prepareScenarioBalanceData(SCENARIO.principal, state);
    expect(data.length).toBe(SCENARIO.termMonths + 1);
    // saldoPrevisto should equal saldoReal at every month with no payments
    for (const point of data) {
      expect(point.saldoPrevisto).toBe(point.saldoReal);
    }
  });

  it("shows real balance below previsto when paying extra reduce-term", () => {
    const baselineInstallment = calculatePriceInstallment({
      principal: SCENARIO.principal,
      monthlyRate: SCENARIO.monthlyRate,
      termMonths: SCENARIO.termMonths,
    });
    const payments: Payment[] = Array.from({ length: 12 }, (_, i) => ({
      referenceMonth: refMonth(SCENARIO.startMonth, i),
      amount: baselineInstallment.plus(1000),
      strategy: "prazo",
    }));
    const state = replayPayments(SCENARIO, payments);
    const data = prepareScenarioBalanceData(SCENARIO.principal, state);
    const point12 = data.find((p) => p.month === 12);
    expect(point12).toBeDefined();
    expect(point12!.saldoReal).toBeLessThan(point12!.saldoPrevisto);
  });
});

describe("prepareScenarioInterestData", () => {
  it("starts at zero for both series at month 0", () => {
    const state = replayPayments(SCENARIO, []);
    const data = prepareScenarioInterestData(state);
    expect(data[0]).toEqual({
      month: 0,
      jurosPrevisto: 0,
      jurosReal: 0,
    });
  });

  it("accumulates monotonically", () => {
    const state = replayPayments(SCENARIO, []);
    const data = prepareScenarioInterestData(state);
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.jurosPrevisto).toBeGreaterThanOrEqual(
        data[i - 1]!.jurosPrevisto,
      );
      expect(data[i]!.jurosReal).toBeGreaterThanOrEqual(
        data[i - 1]!.jurosReal,
      );
    }
  });
});

describe("summarizeScenarioSavings", () => {
  it("returns zero savings and zero months reduced when no payments", () => {
    const state = replayPayments(SCENARIO, []);
    const summary = summarizeScenarioSavings(state);
    expect(summary.monthsReduced).toBe(0);
    // baseline and real terms equal → interest equal, no reduction
    expect(summary.baselineTermMonths).toBe(360);
    expect(summary.realTermMonths).toBe(360);
  });

  it("reports positive interest savings and months reduced for paid extras", () => {
    const baselineInstallment = calculatePriceInstallment({
      principal: SCENARIO.principal,
      monthlyRate: SCENARIO.monthlyRate,
      termMonths: SCENARIO.termMonths,
    });
    const payments: Payment[] = Array.from({ length: 24 }, (_, i) => ({
      referenceMonth: refMonth(SCENARIO.startMonth, i),
      amount: baselineInstallment.plus(500),
      strategy: "prazo",
    }));
    const state = replayPayments(SCENARIO, payments);
    const summary = summarizeScenarioSavings(state);
    expect(summary.interestSaved).toBeGreaterThan(0);
    expect(summary.monthsReduced).toBeGreaterThan(0);
    expect(summary.realTermMonths).toBeLessThan(summary.baselineTermMonths);
  });

  it("baseline totals match the unaltered PRICE schedule", () => {
    const schedule = generatePriceSchedule(SCENARIO);
    const expected = schedule.reduce(
      (acc, row) => acc.plus(row.interest),
      new Decimal(0),
    );
    const state = replayPayments(SCENARIO, []);
    const summary = summarizeScenarioSavings(state);
    expect(summary.baselineTotalInterest).toBeCloseTo(expected.toNumber(), 1);
  });
});
