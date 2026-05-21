import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  simulateRentVsBuy,
  type SimulateRentVsBuyInputs,
} from "./rent-vs-buy";

const ZERO = new Decimal(0);

function input(
  overrides: Partial<SimulateRentVsBuyInputs> = {},
): SimulateRentVsBuyInputs {
  return {
    propertyValue: new Decimal(500_000),
    downPayment: new Decimal(100_000),
    termMonths: 360,
    annualRate: new Decimal("0.10"),
    monthlyRent: new Decimal(2000),
    annualRentAdjustment: new Decimal("0.05"),
    annualPropertyAppreciation: new Decimal("0.05"),
    annualInvestmentReturn: new Decimal("0.08"),
    horizonMonths: 360,
    ...overrides,
  };
}

describe("simulateRentVsBuy — defaults", () => {
  const result = simulateRentVsBuy(input());

  it("emits horizonMonths + 1 entries per timeline", () => {
    expect(result.buyTimeline).toHaveLength(361);
    expect(result.rentTimeline).toHaveLength(361);
    expect(result.buyTimeline[0].month).toBe(0);
    expect(result.buyTimeline[360].month).toBe(360);
  });

  it("applies default purchaseCostPct=0.03 so renter starts richer than buyer", () => {
    // Buyer's invested cash starts at zero; renter starts with downPayment +
    // purchaseCosts = 100_000 + 500_000·0.03 = 115_000.
    expect(result.rentTimeline[0].investedCapital.equals(115_000)).toBe(true);
    expect(result.buyTimeline[0].investedDifference.equals(0)).toBe(true);
  });

  it("applies default saleCostPct=0.06 in the buyer net-worth formula at m=0", () => {
    // 500_000 · 0.94 − 400_000 + 0 = 70_000
    expect(result.buyTimeline[0].netWorth.equals(70_000)).toBe(true);
  });

  it("loan is paid off by termMonths (final outstandingBalance = 0)", () => {
    expect(result.buyTimeline[360].outstandingBalance.equals(0)).toBe(true);
  });
});

describe("simulateRentVsBuy — comprar ganha (buy wins)", () => {
  // Strong appreciation, modest investment return, no purchase/sale friction.
  const result = simulateRentVsBuy(
    input({
      annualPropertyAppreciation: new Decimal("0.10"),
      annualInvestmentReturn: new Decimal("0.04"),
      monthlyRent: new Decimal(2500),
      purchaseCostPct: ZERO,
      saleCostPct: ZERO,
    }),
  );

  it("declares buy as best scenario", () => {
    expect(result.summary.bestScenario).toBe("buy");
  });

  it("final difference is positive", () => {
    expect(result.summary.netWorthDifferenceFinal.greaterThan(0)).toBe(true);
  });
});

describe("simulateRentVsBuy — alugar ganha (rent wins)", () => {
  const result = simulateRentVsBuy(
    input({
      annualInvestmentReturn: new Decimal("0.15"),
      annualPropertyAppreciation: ZERO,
      monthlyRent: new Decimal(1200),
      purchaseCostPct: new Decimal("0.05"),
      saleCostPct: new Decimal("0.06"),
    }),
  );

  it("declares rent as best scenario", () => {
    expect(result.summary.bestScenario).toBe("rent");
  });

  it("final difference is negative", () => {
    expect(result.summary.netWorthDifferenceFinal.lessThan(0)).toBe(true);
  });

  it("returns null break-even when buy never catches up", () => {
    expect(result.summary.breakEvenMonth).toBeNull();
  });
});

describe("simulateRentVsBuy — empate (tie)", () => {
  // Same construction as the MVP tie test: zero rates and free rent so each
  // month the renter contributes exactly the buyer's installment; with no
  // appreciation, no purchase/sale costs, and no investment growth, both sides
  // end at the same net worth.
  const result = simulateRentVsBuy({
    propertyValue: new Decimal(1000),
    downPayment: new Decimal(100),
    termMonths: 9,
    annualRate: ZERO,
    monthlyRent: ZERO,
    annualRentAdjustment: ZERO,
    annualInvestmentReturn: ZERO,
    annualPropertyAppreciation: ZERO,
    purchaseCostPct: ZERO,
    saleCostPct: ZERO,
    horizonMonths: 9,
  });

  it("ties at end of horizon", () => {
    expect(result.summary.bestScenario).toBe("tie");
    expect(result.summary.netWorthDifferenceFinal.equals(0)).toBe(true);
  });

  it("ties every month", () => {
    for (let m = 0; m <= 9; m++) {
      expect(result.buyTimeline[m].netWorth.equals(result.rentTimeline[m].netWorth)).toBe(
        true,
      );
    }
  });

  it("reports break-even at month 1", () => {
    expect(result.summary.breakEvenMonth).toBe(1);
  });
});

describe("simulateRentVsBuy — rendimento=0", () => {
  // With zero investment return, invested balances accumulate by contribution
  // only — no compounding.
  const result = simulateRentVsBuy(
    input({
      annualInvestmentReturn: ZERO,
      purchaseCostPct: ZERO,
      saleCostPct: ZERO,
      horizonMonths: 24,
      termMonths: 24,
    }),
  );

  it("does not compound the renter's starting capital", () => {
    // Renter starts at downPayment=100_000 with purchaseCostPct=0.
    // With zero return, that 100_000 must remain at 100_000 plus any
    // monthly contributions on top.
    const initial = result.rentTimeline[0].investedCapital;
    expect(initial.equals(100_000)).toBe(true);

    let contributions = ZERO;
    for (let m = 1; m <= 24; m++) {
      contributions = contributions.plus(result.rentTimeline[m].monthlyContribution);
    }
    const expectedFinal = initial.plus(contributions);
    const actualFinal = result.rentTimeline[24].investedCapital;
    expect(actualFinal.minus(expectedFinal).abs().lessThan(new Decimal("0.05"))).toBe(
      true,
    );
  });
});

describe("simulateRentVsBuy — valorização=0", () => {
  const result = simulateRentVsBuy(
    input({
      annualPropertyAppreciation: ZERO,
      horizonMonths: 60,
    }),
  );

  it("property value stays constant across the horizon", () => {
    const initial = result.buyTimeline[0].propertyValue;
    expect(initial.equals(500_000)).toBe(true);
    for (let m = 0; m <= 60; m++) {
      expect(result.buyTimeline[m].propertyValue.equals(initial)).toBe(true);
    }
  });
});

describe("simulateRentVsBuy — reajuste aluguel=0", () => {
  const result = simulateRentVsBuy(
    input({
      annualRentAdjustment: ZERO,
      horizonMonths: 36,
    }),
  );

  it("rentPaid stays at monthlyRent across years", () => {
    const monthlyRent = new Decimal(2000);
    // m=0 has rentPaid=0 by spec; m=1..36 should equal monthlyRent.
    for (let m = 1; m <= 36; m++) {
      expect(result.rentTimeline[m].rentPaid.equals(monthlyRent)).toBe(true);
    }
  });
});

describe("simulateRentVsBuy — horizonte longo (30 anos)", () => {
  it("runs for 360 months without error and reports a finite difference", () => {
    const result = simulateRentVsBuy(input({ horizonMonths: 360 }));
    expect(result.buyTimeline).toHaveLength(361);
    expect(result.rentTimeline).toHaveLength(361);
    expect(Number.isFinite(result.summary.netWorthDifferenceFinal.toNumber())).toBe(
      true,
    );
  });
});

describe("simulateRentVsBuy — purchase costs effect", () => {
  it("higher purchaseCostPct gives the renter more starting capital", () => {
    const low = simulateRentVsBuy(
      input({ purchaseCostPct: new Decimal("0.01"), horizonMonths: 12, termMonths: 12 }),
    );
    const high = simulateRentVsBuy(
      input({ purchaseCostPct: new Decimal("0.08"), horizonMonths: 12, termMonths: 12 }),
    );
    // 500_000 · 0.01 = 5_000 vs 500_000 · 0.08 = 40_000 added on top of 100_000.
    expect(low.rentTimeline[0].investedCapital.equals(105_000)).toBe(true);
    expect(high.rentTimeline[0].investedCapital.equals(140_000)).toBe(true);
    expect(high.rentTimeline[0].netWorth.greaterThan(low.rentTimeline[0].netWorth)).toBe(
      true,
    );
  });
});

describe("simulateRentVsBuy — saleCostPct=0", () => {
  it("buyer net worth at m=0 equals downPayment when both purchase and sale costs are zero", () => {
    const result = simulateRentVsBuy(
      input({ purchaseCostPct: ZERO, saleCostPct: ZERO }),
    );
    // 500_000 · 1.0 − 400_000 + 0 = 100_000 = downPayment.
    expect(result.buyTimeline[0].netWorth.equals(100_000)).toBe(true);
  });

  it("lowering saleCostPct from default to zero strictly improves buyer's final net worth", () => {
    const withCosts = simulateRentVsBuy(
      input({ saleCostPct: new Decimal("0.06") }),
    );
    const noCosts = simulateRentVsBuy(input({ saleCostPct: ZERO }));
    const finalA = withCosts.buyTimeline[360].netWorth;
    const finalB = noCosts.buyTimeline[360].netWorth;
    expect(finalB.greaterThan(finalA)).toBe(true);
  });
});

describe("simulateRentVsBuy — breakEven detection", () => {
  // Buyer starts behind because of purchase + sale friction; high appreciation
  // eventually closes the gap and break-even occurs mid-horizon.
  const result = simulateRentVsBuy(
    input({
      annualRate: new Decimal("0.12"),
      monthlyRent: new Decimal(1500),
      annualInvestmentReturn: new Decimal("0.06"),
      annualPropertyAppreciation: new Decimal("0.10"),
      annualRentAdjustment: new Decimal("0.05"),
      purchaseCostPct: new Decimal("0.03"),
      saleCostPct: new Decimal("0.06"),
    }),
  );

  it("returns a non-null break-even month after month 1", () => {
    expect(result.summary.breakEvenMonth).not.toBeNull();
    expect(result.summary.breakEvenMonth!).toBeGreaterThan(1);
  });

  it("buy is strictly behind in the previous month and at-or-ahead at break-even", () => {
    const k = result.summary.breakEvenMonth!;
    const prevBuy = result.buyTimeline[k - 1].netWorth;
    const prevRent = result.rentTimeline[k - 1].netWorth;
    const buy = result.buyTimeline[k].netWorth;
    const rent = result.rentTimeline[k].netWorth;
    expect(prevBuy.lessThan(prevRent)).toBe(true);
    expect(buy.greaterThanOrEqualTo(rent)).toBe(true);
  });
});

describe("simulateRentVsBuy — buyTimeline shape", () => {
  const result = simulateRentVsBuy(input({ termMonths: 12, horizonMonths: 12 }));

  it("monthlyOwnershipOutflow equals paidInstallment when no ownership costs are passed", () => {
    for (let m = 1; m <= 12; m++) {
      const row = result.buyTimeline[m];
      expect(row.monthlyOwnershipOutflow.equals(row.paidInstallment)).toBe(true);
    }
  });

  it("monthlyOwnershipOutflow includes monthlyOwnershipCosts when provided", () => {
    const withCosts = simulateRentVsBuy(
      input({
        termMonths: 12,
        horizonMonths: 12,
        monthlyOwnershipCosts: new Decimal(300),
      }),
    );
    for (let m = 1; m <= 12; m++) {
      const row = withCosts.buyTimeline[m];
      expect(
        row.monthlyOwnershipOutflow.minus(row.paidInstallment).equals(300),
      ).toBe(true);
    }
  });

  it("paidInstallment is zero after termMonths but timeline continues", () => {
    const result = simulateRentVsBuy(
      input({ termMonths: 60, horizonMonths: 120 }),
    );
    for (let m = 61; m <= 120; m++) {
      expect(result.buyTimeline[m].paidInstallment.equals(0)).toBe(true);
      expect(result.buyTimeline[m].outstandingBalance.equals(0)).toBe(true);
    }
  });
});

describe("simulateRentVsBuy — rent adjustment cadence", () => {
  const result = simulateRentVsBuy(
    input({
      monthlyRent: new Decimal(2000),
      annualRentAdjustment: new Decimal("0.05"),
      annualPropertyAppreciation: ZERO,
      horizonMonths: 36,
      termMonths: 36,
    }),
  );

  it("rent stays constant for months 1–11 then adjusts at month 12 and 24", () => {
    const original = new Decimal(2000);
    expect(result.rentTimeline[1].rentPaid.equals(original)).toBe(true);
    expect(result.rentTimeline[11].rentPaid.equals(original)).toBe(true);
    const y1 = result.rentTimeline[12].rentPaid;
    expect(y1.greaterThan(original)).toBe(true);
    expect(result.rentTimeline[23].rentPaid.equals(y1)).toBe(true);
    const y2 = result.rentTimeline[24].rentPaid;
    const expected = original.times(new Decimal("1.05").pow(2));
    expect(y2.minus(expected).abs().lessThanOrEqualTo(new Decimal("0.01"))).toBe(
      true,
    );
  });
});

describe("simulateRentVsBuy — validation", () => {
  it("throws when propertyValue is zero", () => {
    expect(() => simulateRentVsBuy(input({ propertyValue: ZERO }))).toThrow(
      /propertyValue/,
    );
  });

  it("throws when downPayment >= propertyValue", () => {
    expect(() =>
      simulateRentVsBuy(
        input({
          propertyValue: new Decimal(100),
          downPayment: new Decimal(100),
        }),
      ),
    ).toThrow(/downPayment/);
  });

  it("throws when termMonths is zero", () => {
    expect(() => simulateRentVsBuy(input({ termMonths: 0 }))).toThrow(/termMonths/);
  });

  it("throws when annualRate is negative", () => {
    expect(() =>
      simulateRentVsBuy(input({ annualRate: new Decimal("-0.01") })),
    ).toThrow(/annualRate/);
  });

  it("throws when saleCostPct >= 1", () => {
    expect(() =>
      simulateRentVsBuy(input({ saleCostPct: new Decimal("1.0") })),
    ).toThrow(/saleCostPct/);
  });

  it("throws when purchaseCostPct is negative", () => {
    expect(() =>
      simulateRentVsBuy(input({ purchaseCostPct: new Decimal("-0.01") })),
    ).toThrow(/purchaseCostPct/);
  });
});

describe("simulateRentVsBuy — SAC support", () => {
  it("works with SAC schedule and pays off the loan by term", () => {
    const result = simulateRentVsBuy(input({ system: "SAC" }));
    expect(result.buyTimeline[360].outstandingBalance.equals(0)).toBe(true);
    expect(["buy", "rent", "tie"]).toContain(result.summary.bestScenario);
  });
});
