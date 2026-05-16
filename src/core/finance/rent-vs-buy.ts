import Decimal from "decimal.js";
import {
  type AmortizationSystem,
  type FinancingInputs,
  type ScheduleRow,
  roundMoney,
} from "./financial-types";
import { generatePriceSchedule, generateSacSchedule } from "./amortization";

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

// Final-month difference within R$ 0.01 is treated as a tie (matches money rounding).
const TIE_TOLERANCE = new Decimal("0.01");

export interface RentVsBuyInputs {
  propertyValue: Decimal;
  downPayment: Decimal;
  monthlyRate: Decimal;
  termMonths: number;
  system?: AmortizationSystem;
  monthlyRent: Decimal;
  annualRentAdjustment: Decimal;
  annualInvestmentReturn: Decimal;
  annualAppreciation: Decimal;
  monthlyOwnershipCosts: Decimal;
  horizonMonths: number;
}

export interface BuyTimelineEntry {
  month: number;
  propertyValue: Decimal;
  outstandingBalance: Decimal;
  investedCapital: Decimal;
  netWorth: Decimal;
}

export interface RentTimelineEntry {
  month: number;
  rent: Decimal;
  investedCapital: Decimal;
  monthlyContribution: Decimal;
  netWorth: Decimal;
}

export type Scenario = "buy" | "rent" | "tie";

export interface RentVsBuySummary {
  bestScenario: Scenario;
  netWorthDifferenceFinal: Decimal;
  breakEvenMonth: number | null;
}

export interface RentVsBuyResult {
  buyTimeline: BuyTimelineEntry[];
  rentTimeline: RentTimelineEntry[];
  summary: RentVsBuySummary;
}

/**
 * Convert an effective annual rate to its equivalent monthly compounding rate:
 * (1 + annual)^(1/12) - 1.
 */
export function annualToMonthlyRate(annualRate: Decimal): Decimal {
  if (annualRate.isZero()) return ZERO;
  return ONE.plus(annualRate).pow(ONE.div(12)).minus(1);
}

function validateInputs(inputs: RentVsBuyInputs): void {
  if (inputs.propertyValue.lessThanOrEqualTo(0)) {
    throw new Error("propertyValue must be greater than zero");
  }
  if (inputs.downPayment.isNegative()) {
    throw new Error("downPayment must be non-negative");
  }
  if (inputs.downPayment.greaterThanOrEqualTo(inputs.propertyValue)) {
    throw new Error("downPayment must be less than propertyValue");
  }
  if (inputs.termMonths <= 0) {
    throw new Error("termMonths must be greater than zero");
  }
  if (inputs.monthlyRate.isNegative()) {
    throw new Error("monthlyRate must be non-negative");
  }
  if (inputs.monthlyRent.isNegative()) {
    throw new Error("monthlyRent must be non-negative");
  }
  if (inputs.annualRentAdjustment.isNegative()) {
    throw new Error("annualRentAdjustment must be non-negative");
  }
  if (inputs.annualInvestmentReturn.isNegative()) {
    throw new Error("annualInvestmentReturn must be non-negative");
  }
  if (inputs.annualAppreciation.isNegative()) {
    throw new Error("annualAppreciation must be non-negative");
  }
  if (inputs.monthlyOwnershipCosts.isNegative()) {
    throw new Error("monthlyOwnershipCosts must be non-negative");
  }
  if (inputs.horizonMonths <= 0) {
    throw new Error("horizonMonths must be greater than zero");
  }
}

function buildSchedule(inputs: RentVsBuyInputs): ScheduleRow[] {
  const principal = inputs.propertyValue.minus(inputs.downPayment);
  const financingInputs: FinancingInputs = {
    principal,
    monthlyRate: inputs.monthlyRate,
    termMonths: inputs.termMonths,
    system: inputs.system,
  };
  return inputs.system === "SAC"
    ? generateSacSchedule(financingInputs)
    : generatePriceSchedule(financingInputs);
}

/**
 * Symmetric monthly comparison:
 * - Both parties start with liquid wealth equal to downPayment. Buyer spends it
 *   on the property; renter invests it.
 * - Each month the lower-spending side invests the difference at the monthly
 *   investment rate. The higher-spending side contributes nothing that month
 *   (no negative contributions / no borrowing to invest).
 * - Buy net worth = propertyValue − outstandingBalance + investedCapital.
 * - Rent net worth = investedCapital.
 *
 * The break-even month is the first month ≥ 1 where the buy net worth catches
 * up to (or exceeds) the rent net worth. If buy never catches up, it is null.
 */
export function compareRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  validateInputs(inputs);

  const monthlyReturn = annualToMonthlyRate(inputs.annualInvestmentReturn);
  const monthlyAppreciation = annualToMonthlyRate(inputs.annualAppreciation);
  const schedule = buildSchedule(inputs);
  const principal = inputs.propertyValue.minus(inputs.downPayment);

  let buyPropertyValue = inputs.propertyValue;
  let buyOutstandingBalance = roundMoney(principal);
  let buyInvestedCapital = ZERO;
  let rentInvestedCapital = roundMoney(inputs.downPayment);
  let currentRent = inputs.monthlyRent;

  const buyTimeline: BuyTimelineEntry[] = [
    {
      month: 0,
      propertyValue: roundMoney(buyPropertyValue),
      outstandingBalance: buyOutstandingBalance,
      investedCapital: buyInvestedCapital,
      netWorth: roundMoney(
        buyPropertyValue.minus(buyOutstandingBalance).plus(buyInvestedCapital),
      ),
    },
  ];
  const rentTimeline: RentTimelineEntry[] = [
    {
      month: 0,
      rent: roundMoney(currentRent),
      investedCapital: rentInvestedCapital,
      monthlyContribution: ZERO,
      netWorth: rentInvestedCapital,
    },
  ];

  let breakEvenMonth: number | null = null;

  for (let m = 1; m <= inputs.horizonMonths; m++) {
    if (m >= 12 && m % 12 === 0) {
      currentRent = currentRent.times(ONE.plus(inputs.annualRentAdjustment));
    }

    const scheduleRow = m <= inputs.termMonths ? schedule[m - 1] : null;
    const installment = scheduleRow ? scheduleRow.installment : ZERO;
    const newOutstandingBalance = scheduleRow ? scheduleRow.balance : ZERO;

    const buyOutflow = installment.plus(inputs.monthlyOwnershipCosts);
    const rentOutflow = currentRent;

    let buyContribution = ZERO;
    let rentContribution = ZERO;
    const diff = rentOutflow.minus(buyOutflow);
    if (diff.greaterThan(0)) {
      buyContribution = diff;
    } else if (diff.lessThan(0)) {
      rentContribution = diff.negated();
    }

    buyInvestedCapital = buyInvestedCapital
      .times(ONE.plus(monthlyReturn))
      .plus(buyContribution);
    rentInvestedCapital = rentInvestedCapital
      .times(ONE.plus(monthlyReturn))
      .plus(rentContribution);

    buyPropertyValue = buyPropertyValue.times(ONE.plus(monthlyAppreciation));
    buyOutstandingBalance = newOutstandingBalance;

    const buyNetWorth = roundMoney(
      buyPropertyValue.minus(buyOutstandingBalance).plus(buyInvestedCapital),
    );
    const rentNetWorth = roundMoney(rentInvestedCapital);

    buyTimeline.push({
      month: m,
      propertyValue: roundMoney(buyPropertyValue),
      outstandingBalance: roundMoney(buyOutstandingBalance),
      investedCapital: roundMoney(buyInvestedCapital),
      netWorth: buyNetWorth,
    });
    rentTimeline.push({
      month: m,
      rent: roundMoney(currentRent),
      investedCapital: roundMoney(rentInvestedCapital),
      monthlyContribution: roundMoney(rentContribution),
      netWorth: rentNetWorth,
    });

    if (
      breakEvenMonth === null &&
      buyNetWorth.greaterThanOrEqualTo(rentNetWorth)
    ) {
      breakEvenMonth = m;
    }
  }

  const finalBuyNW = buyTimeline[buyTimeline.length - 1].netWorth;
  const finalRentNW = rentTimeline[rentTimeline.length - 1].netWorth;
  const netWorthDifferenceFinal = finalBuyNW.minus(finalRentNW);

  let bestScenario: Scenario;
  if (netWorthDifferenceFinal.abs().lessThanOrEqualTo(TIE_TOLERANCE)) {
    bestScenario = "tie";
  } else if (netWorthDifferenceFinal.greaterThan(0)) {
    bestScenario = "buy";
  } else {
    bestScenario = "rent";
  }

  return {
    buyTimeline,
    rentTimeline,
    summary: {
      bestScenario,
      netWorthDifferenceFinal,
      breakEvenMonth,
    },
  };
}
