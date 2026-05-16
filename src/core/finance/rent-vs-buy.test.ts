import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  annualToMonthlyRate,
  compareRentVsBuy,
  type RentVsBuyInputs,
} from "./rent-vs-buy";

const ZERO = new Decimal(0);
const ONE_CENT = new Decimal("0.01");

function input(overrides: Partial<RentVsBuyInputs> = {}): RentVsBuyInputs {
  return {
    propertyValue: new Decimal(500_000),
    downPayment: new Decimal(100_000),
    monthlyRate: new Decimal("0.008"),
    termMonths: 360,
    monthlyRent: new Decimal(2000),
    annualRentAdjustment: new Decimal("0.05"),
    annualInvestmentReturn: new Decimal("0.08"),
    annualAppreciation: new Decimal("0.05"),
    monthlyOwnershipCosts: new Decimal(300),
    horizonMonths: 360,
    ...overrides,
  };
}

describe("annualToMonthlyRate", () => {
  it("returns zero for zero", () => {
    expect(annualToMonthlyRate(ZERO).equals(0)).toBe(true);
  });

  it("converts 12% annual to ~0.9489% monthly that compounds back to 12%", () => {
    const monthly = annualToMonthlyRate(new Decimal("0.12"));
    expect(monthly.toDecimalPlaces(6).toNumber()).toBeCloseTo(0.009489, 5);
    // (1 + monthly)^12 ≈ 1.12 within precision tolerance
    const compounded = monthly.plus(1).pow(12);
    expect(compounded.toDecimalPlaces(8).toNumber()).toBeCloseTo(1.12, 6);
  });
});

describe("compareRentVsBuy — equal-outcome scenario", () => {
  // Free housing for the renter, zero rates, zero appreciation: each month the
  // renter contributes exactly the buyer's installment, so both portfolios grow
  // by the same amount as the buyer pays down principal.
  const result = compareRentVsBuy({
    propertyValue: new Decimal(1000),
    downPayment: new Decimal(100),
    monthlyRate: ZERO,
    termMonths: 9,
    monthlyRent: ZERO,
    annualRentAdjustment: ZERO,
    annualInvestmentReturn: ZERO,
    annualAppreciation: ZERO,
    monthlyOwnershipCosts: ZERO,
    horizonMonths: 9,
  });

  it("ties at end of horizon", () => {
    expect(result.summary.bestScenario).toBe("tie");
    expect(result.summary.netWorthDifferenceFinal.equals(0)).toBe(true);
  });

  it("ties every month from m=1 onward", () => {
    for (let m = 1; m <= 9; m++) {
      const buy = result.buyTimeline[m].netWorth;
      const rent = result.rentTimeline[m].netWorth;
      expect(buy.equals(rent)).toBe(true);
    }
  });

  it("reports break-even at month 1 when buy is never behind", () => {
    expect(result.summary.breakEvenMonth).toBe(1);
  });
});

describe("compareRentVsBuy — buy-wins scenario", () => {
  // Strong appreciation, modest investment return.
  const result = compareRentVsBuy(
    input({
      annualAppreciation: new Decimal("0.10"),
      annualInvestmentReturn: new Decimal("0.04"),
      monthlyRent: new Decimal(2500),
      monthlyOwnershipCosts: new Decimal(200),
    }),
  );

  it("declares buy as the best scenario", () => {
    expect(result.summary.bestScenario).toBe("buy");
  });

  it("reports a positive final difference", () => {
    expect(result.summary.netWorthDifferenceFinal.greaterThan(0)).toBe(true);
  });

  it("eventually crosses to a non-null break-even month", () => {
    expect(result.summary.breakEvenMonth).not.toBeNull();
  });
});

describe("compareRentVsBuy — rent-wins scenario", () => {
  // High investment return, no appreciation, high ownership costs handicap buy.
  const result = compareRentVsBuy(
    input({
      annualInvestmentReturn: new Decimal("0.15"),
      annualAppreciation: ZERO,
      monthlyRent: new Decimal(1200),
      monthlyOwnershipCosts: new Decimal(800),
    }),
  );

  it("declares rent as the best scenario", () => {
    expect(result.summary.bestScenario).toBe("rent");
  });

  it("reports a negative final difference", () => {
    expect(result.summary.netWorthDifferenceFinal.lessThan(0)).toBe(true);
  });

  it("returns null break-even (no-break-even case)", () => {
    expect(result.summary.breakEvenMonth).toBeNull();
  });
});

describe("compareRentVsBuy — break-even detection", () => {
  // Mid-horizon crossover: buy outflow > rent so the renter accumulates capital
  // early, but appreciation (10%/yr) outpaces the renter's portfolio (6%/yr) so
  // buy eventually catches up and finishes ahead.
  const result = compareRentVsBuy(
    input({
      monthlyRate: new Decimal("0.012"),
      monthlyRent: new Decimal(1500),
      monthlyOwnershipCosts: new Decimal(600),
      annualInvestmentReturn: new Decimal("0.06"),
      annualAppreciation: new Decimal("0.10"),
      annualRentAdjustment: new Decimal("0.05"),
    }),
  );

  it("returns a non-null break-even month strictly after month 1", () => {
    expect(result.summary.breakEvenMonth).not.toBeNull();
    expect(result.summary.breakEvenMonth!).toBeGreaterThan(1);
  });

  it("buy is strictly behind in the previous month and caught up at break-even", () => {
    const k = result.summary.breakEvenMonth!;
    const prevBuy = result.buyTimeline[k - 1].netWorth;
    const prevRent = result.rentTimeline[k - 1].netWorth;
    const buy = result.buyTimeline[k].netWorth;
    const rent = result.rentTimeline[k].netWorth;
    expect(prevBuy.lessThan(prevRent)).toBe(true);
    expect(buy.greaterThanOrEqualTo(rent)).toBe(true);
  });
});

describe("compareRentVsBuy — invariants", () => {
  const result = compareRentVsBuy(input());

  it("emits horizonMonths + 1 timeline entries (m=0 through m=horizon)", () => {
    expect(result.buyTimeline).toHaveLength(361);
    expect(result.rentTimeline).toHaveLength(361);
    expect(result.buyTimeline[0].month).toBe(0);
    expect(result.buyTimeline[360].month).toBe(360);
    expect(result.rentTimeline[0].month).toBe(0);
    expect(result.rentTimeline[360].month).toBe(360);
  });

  it("starts both sides at down-payment net worth", () => {
    const inputs = input();
    expect(result.buyTimeline[0].netWorth.equals(inputs.downPayment)).toBe(
      true,
    );
    expect(result.rentTimeline[0].netWorth.equals(inputs.downPayment)).toBe(
      true,
    );
    expect(result.buyTimeline[0].investedCapital.equals(0)).toBe(true);
    expect(
      result.rentTimeline[0].investedCapital.equals(inputs.downPayment),
    ).toBe(true);
  });

  it("starts buy outstanding balance equal to principal (propertyValue − downPayment)", () => {
    expect(result.buyTimeline[0].outstandingBalance.equals(400_000)).toBe(true);
  });

  it("never produces a negative monthly contribution", () => {
    for (const row of result.rentTimeline) {
      expect(row.monthlyContribution.greaterThanOrEqualTo(0)).toBe(true);
    }
  });

  it("rent stays constant for months 1–11, adjusts at month 12, then again at 24", () => {
    const original = result.rentTimeline[0].rent;
    expect(result.rentTimeline[1].rent.equals(original)).toBe(true);
    expect(result.rentTimeline[11].rent.equals(original)).toBe(true);

    const adjustedYear1 = result.rentTimeline[12].rent;
    expect(adjustedYear1.greaterThan(original)).toBe(true);
    expect(result.rentTimeline[13].rent.equals(adjustedYear1)).toBe(true);
    expect(result.rentTimeline[23].rent.equals(adjustedYear1)).toBe(true);

    const adjustedYear2 = result.rentTimeline[24].rent;
    expect(adjustedYear2.greaterThan(adjustedYear1)).toBe(true);
    // Year-2 rent ≈ original × (1 + adj)^2
    const expected = new Decimal(2000).times(new Decimal("1.05").pow(2));
    expect(adjustedYear2.minus(expected).abs().lessThanOrEqualTo(ONE_CENT)).toBe(
      true,
    );
  });

  it("property value grows geometrically with monthly appreciation", () => {
    // 5% annual appreciation over 12 months ≈ 1.05× propertyValue
    const expected = new Decimal(500_000).times(new Decimal("1.05"));
    const actual = result.buyTimeline[12].propertyValue;
    expect(actual.minus(expected).abs().lessThan(new Decimal(1))).toBe(true);
  });

  it("loan is paid off by termMonths (final balance = 0)", () => {
    expect(result.buyTimeline[360].outstandingBalance.equals(0)).toBe(true);
  });
});

describe("compareRentVsBuy — horizon longer than term", () => {
  it("continues post-loan with no installment, only ownership costs", () => {
    const result = compareRentVsBuy(
      input({
        termMonths: 60,
        horizonMonths: 120,
      }),
    );
    // Loan paid off at m=60; no further outstanding balance.
    for (let m = 60; m <= 120; m++) {
      expect(result.buyTimeline[m].outstandingBalance.equals(0)).toBe(true);
    }
    expect(result.buyTimeline).toHaveLength(121);
  });
});

describe("compareRentVsBuy — validation", () => {
  it("throws when propertyValue is zero", () => {
    expect(() => compareRentVsBuy(input({ propertyValue: ZERO }))).toThrow(
      /propertyValue/,
    );
  });

  it("throws when downPayment ≥ propertyValue", () => {
    expect(() =>
      compareRentVsBuy(
        input({
          propertyValue: new Decimal(100),
          downPayment: new Decimal(100),
        }),
      ),
    ).toThrow(/downPayment/);
  });

  it("throws when downPayment is negative", () => {
    expect(() =>
      compareRentVsBuy(input({ downPayment: new Decimal(-1) })),
    ).toThrow(/downPayment/);
  });

  it("throws when termMonths is zero", () => {
    expect(() => compareRentVsBuy(input({ termMonths: 0 }))).toThrow(
      /termMonths/,
    );
  });

  it("throws when monthlyRate is negative", () => {
    expect(() =>
      compareRentVsBuy(input({ monthlyRate: new Decimal("-0.001") })),
    ).toThrow(/monthlyRate/);
  });

  it("throws when monthlyRent is negative", () => {
    expect(() =>
      compareRentVsBuy(input({ monthlyRent: new Decimal(-100) })),
    ).toThrow(/monthlyRent/);
  });

  it("throws when annualInvestmentReturn is negative", () => {
    expect(() =>
      compareRentVsBuy(input({ annualInvestmentReturn: new Decimal(-0.01) })),
    ).toThrow(/annualInvestmentReturn/);
  });

  it("throws when horizonMonths is zero", () => {
    expect(() => compareRentVsBuy(input({ horizonMonths: 0 }))).toThrow(
      /horizonMonths/,
    );
  });
});

describe("compareRentVsBuy — SAC system support", () => {
  it("works with SAC schedule and produces a valid result", () => {
    const result = compareRentVsBuy(input({ system: "SAC" }));
    expect(result.buyTimeline[360].outstandingBalance.equals(0)).toBe(true);
    expect(["buy", "rent", "tie"]).toContain(result.summary.bestScenario);
  });
});
