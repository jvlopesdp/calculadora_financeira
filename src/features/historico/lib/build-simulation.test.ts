import { describe, expect, it } from "vitest";

import type { PaymentApi, ScenarioApi } from "@/lib/api-client";

import { buildSimulation, nextReferenceMonth } from "./build-simulation";

function scenario(overrides: Partial<ScenarioApi> = {}): ScenarioApi {
  return {
    id: "sc-1",
    user_id: "u-1",
    name: "Apto Vila Mariana",
    // 600k property, 120k down → 480k principal
    property_value_cents: 600_000_00,
    down_payment_cents: 120_000_00,
    term_months: 360,
    // 9.5% a.a. → 950 bp
    annual_rate_basis_points: 950,
    start_date: "2024-01-01",
    created_at: 0,
    archived_at: null,
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentApi>): PaymentApi {
  return {
    id: "p-1",
    scenario_id: "sc-1",
    reference_month: "2024-01",
    payment_date: "2024-01-05",
    amount_paid_cents: 0,
    payment_type: "parcela",
    amortization_strategy: "prazo",
    notes: null,
    created_at: 0,
    ...overrides,
  };
}

describe("nextReferenceMonth", () => {
  it("returns the scenario start month when there are no payments", () => {
    expect(nextReferenceMonth(scenario(), [])).toBe("2024-01");
  });

  it("returns the month after the latest payment", () => {
    const payments = [
      payment({ id: "p-1", reference_month: "2024-01" }),
      payment({ id: "p-2", reference_month: "2024-03" }),
      payment({ id: "p-3", reference_month: "2024-02" }),
    ];
    expect(nextReferenceMonth(scenario(), payments)).toBe("2024-04");
  });

  it("rolls over years at december", () => {
    const payments = [payment({ reference_month: "2024-12" })];
    expect(nextReferenceMonth(scenario(), payments)).toBe("2025-01");
  });
});

describe("buildSimulation", () => {
  it("returns null when amount is zero or negative", () => {
    expect(
      buildSimulation({
        scenario: scenario(),
        payments: [],
        amountBRL: 0,
        strategy: "prazo",
      }),
    ).toBeNull();
    expect(
      buildSimulation({
        scenario: scenario(),
        payments: [],
        amountBRL: -100,
        strategy: "prazo",
      }),
    ).toBeNull();
  });

  it("produces savings when paying more than the base installment (prazo)", () => {
    const result = buildSimulation({
      scenario: scenario(),
      payments: [],
      amountBRL: 10_000,
      strategy: "prazo",
    });
    expect(result).not.toBeNull();
    if (!result) return;
    // Reference month should be the scenario's first month.
    expect(result.referenceMonth).toBe("2024-01");
    // Paying extra reduces the future balance and total interest.
    expect(result.deltaBalance.lessThan(0)).toBe(true);
    expect(result.deltaRemainingMonths).toBeLessThan(0);
    expect(result.interestSavings.greaterThan(0)).toBe(true);
  });

  it("matches the base installment exactly → zero deltas", () => {
    const sc = scenario();
    // First compute the base installment by running a tiny simulation.
    const probe = buildSimulation({
      scenario: sc,
      payments: [],
      amountBRL: 1, // any positive value works to surface baseInstallment
      strategy: "prazo",
    });
    expect(probe).not.toBeNull();
    if (!probe) return;
    const baseAmount = probe.baseInstallment.toNumber();

    const result = buildSimulation({
      scenario: sc,
      payments: [],
      amountBRL: baseAmount,
      strategy: "prazo",
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.deltaBalance.isZero()).toBe(true);
    expect(result.deltaRemainingMonths).toBe(0);
    expect(result.interestSavings.isZero()).toBe(true);
  });

  it("uses the month AFTER the last real payment as reference", () => {
    const result = buildSimulation({
      scenario: scenario(),
      payments: [
        payment({ id: "p-1", reference_month: "2024-01", amount_paid_cents: 400_000 }),
        payment({ id: "p-2", reference_month: "2024-02", amount_paid_cents: 400_000 }),
      ],
      amountBRL: 5000,
      strategy: "prazo",
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.referenceMonth).toBe("2024-03");
  });

  it("'parcela' strategy keeps remaining months similar but reduces the next installment", () => {
    const sc = scenario();
    const prazo = buildSimulation({
      scenario: sc,
      payments: [],
      amountBRL: 20_000,
      strategy: "prazo",
    });
    const parcela = buildSimulation({
      scenario: sc,
      payments: [],
      amountBRL: 20_000,
      strategy: "parcela",
    });
    expect(prazo).not.toBeNull();
    expect(parcela).not.toBeNull();
    if (!prazo || !parcela) return;
    // Reducing the parcela should leave more months remaining than reducing prazo.
    expect(parcela.hypothetical.remainingMonths).toBeGreaterThan(
      prazo.hypothetical.remainingMonths,
    );
    // And the next scheduled installment for "parcela" should be smaller than the original base.
    expect(
      parcela.hypothetical.nextScheduledPayment.lessThan(prazo.baseInstallment),
    ).toBe(true);
  });
});
