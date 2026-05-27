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

const DEFAULT_PURCHASE_COST_PCT = new Decimal("0.03");
const DEFAULT_SALE_COST_PCT = new Decimal("0.06");

export type Scenario = "buy" | "rent" | "tie";

/**
 * Convert an effective annual rate to its equivalent monthly compounding rate:
 * (1 + annual)^(1/12) - 1.
 */
export function annualToMonthlyRate(annualRate: Decimal): Decimal {
  if (annualRate.isZero()) return ZERO;
  return ONE.plus(annualRate).pow(ONE.div(12)).minus(1);
}

/**
 * Inverse of annualToMonthlyRate: (1 + monthly)^12 - 1.
 */
export function monthlyToAnnualRate(monthlyRate: Decimal): Decimal {
  if (monthlyRate.isZero()) return ZERO;
  return ONE.plus(monthlyRate).pow(12).minus(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// New "Investidor Sardinha"-style engine: simulateRentVsBuy
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulateRentVsBuyInputs {
  propertyValue: Decimal;
  downPayment: Decimal;
  termMonths: number;
  /** Effective annual financing rate (e.g. 0.10 for 10%/yr). */
  annualRate: Decimal;
  monthlyRent: Decimal;
  /** Effective annual rent adjustment applied every 12 months. */
  annualRentAdjustment: Decimal;
  /** Effective annual property appreciation. */
  annualPropertyAppreciation: Decimal;
  /** Effective annual investment return for surplus cash. */
  annualInvestmentReturn: Decimal;
  /** Fraction of propertyValue spent up-front on ITBI + escritura. Defaults to 0.03. */
  purchaseCostPct?: Decimal;
  /** Fraction of propertyValue deducted at sale (e.g. corretagem). Defaults to 0.06. */
  saleCostPct?: Decimal;
  horizonMonths: number;
  /** Optional amortization system; defaults to PRICE inside the schedule generator. */
  system?: AmortizationSystem;
  /** Optional recurring ownership costs (IPTU, condomínio, manutenção). Defaults to zero. */
  monthlyOwnershipCosts?: Decimal;
}

export interface SimulateBuyTimelineEntry {
  month: number;
  propertyValue: Decimal;
  outstandingBalance: Decimal;
  paidInstallment: Decimal;
  monthlyOwnershipOutflow: Decimal;
  investedDifference: Decimal;
  netWorth: Decimal;
}

export interface SimulateRentTimelineEntry {
  month: number;
  rentPaid: Decimal;
  monthlyContribution: Decimal;
  investedCapital: Decimal;
  netWorth: Decimal;
}

export interface SimulateRentVsBuySummary {
  bestScenario: Scenario;
  netWorthDifferenceFinal: Decimal;
  breakEvenMonth: number | null;
}

export interface SimulateRentVsBuyResult {
  buyTimeline: SimulateBuyTimelineEntry[];
  rentTimeline: SimulateRentTimelineEntry[];
  summary: SimulateRentVsBuySummary;
}

function validateSimulateInputs(inputs: SimulateRentVsBuyInputs): void {
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
  if (inputs.annualRate.isNegative()) {
    throw new Error("annualRate must be non-negative");
  }
  if (inputs.monthlyRent.isNegative()) {
    throw new Error("monthlyRent must be non-negative");
  }
  if (inputs.annualRentAdjustment.isNegative()) {
    throw new Error("annualRentAdjustment must be non-negative");
  }
  if (inputs.annualPropertyAppreciation.isNegative()) {
    throw new Error("annualPropertyAppreciation must be non-negative");
  }
  if (inputs.annualInvestmentReturn.isNegative()) {
    throw new Error("annualInvestmentReturn must be non-negative");
  }
  if (inputs.purchaseCostPct && inputs.purchaseCostPct.isNegative()) {
    throw new Error("purchaseCostPct must be non-negative");
  }
  if (inputs.saleCostPct) {
    if (inputs.saleCostPct.isNegative()) {
      throw new Error("saleCostPct must be non-negative");
    }
    if (inputs.saleCostPct.greaterThanOrEqualTo(1)) {
      throw new Error("saleCostPct must be less than 1");
    }
  }
  if (
    inputs.monthlyOwnershipCosts &&
    inputs.monthlyOwnershipCosts.isNegative()
  ) {
    throw new Error("monthlyOwnershipCosts must be non-negative");
  }
  if (inputs.horizonMonths <= 0) {
    throw new Error("horizonMonths must be greater than zero");
  }
}

function buildSimulateSchedule(
  inputs: SimulateRentVsBuyInputs,
  monthlyRate: Decimal,
): ScheduleRow[] {
  const principal = inputs.propertyValue.minus(inputs.downPayment);
  const financingInputs: FinancingInputs = {
    principal,
    monthlyRate,
    termMonths: inputs.termMonths,
    system: inputs.system,
  };
  return inputs.system === "SAC"
    ? generateSacSchedule(financingInputs)
    : generatePriceSchedule(financingInputs);
}

/**
 * Month-by-month wealth simulation inspired by Investidor Sardinha's rent-vs-buy
 * comparator.
 *
 * - Both parties start with the same liquid wealth = `downPayment + purchaseCosts`.
 *   The buyer spends it on the property entry (down payment + ITBI/escritura), so
 *   their invested cash starts at zero. The renter keeps everything invested.
 * - Each month, the side with the lower monthly outflow invests the difference.
 *   The higher-spending side contributes nothing that month (no borrowing to
 *   invest, no negative contributions).
 * - Buy net worth = propertyValue · (1 − saleCostPct) − outstandingBalance +
 *   investedDifference. This already accounts for corretagem at exit.
 * - Rent net worth = investedCapital (rent paid is already debited by reducing
 *   the renter's monthly contribution).
 * - The break-even month is the first month ≥ 1 where buy ≥ rent. Null if buy
 *   never catches up.
 */
export function simulateRentVsBuy(
  inputs: SimulateRentVsBuyInputs,
): SimulateRentVsBuyResult {
  validateSimulateInputs(inputs);

  const purchaseCostPct = inputs.purchaseCostPct ?? DEFAULT_PURCHASE_COST_PCT;
  const saleCostPct = inputs.saleCostPct ?? DEFAULT_SALE_COST_PCT;
  const monthlyOwnershipCosts = inputs.monthlyOwnershipCosts ?? ZERO;

  const monthlyRate = annualToMonthlyRate(inputs.annualRate);
  const monthlyReturn = annualToMonthlyRate(inputs.annualInvestmentReturn);
  const monthlyAppreciation = annualToMonthlyRate(
    inputs.annualPropertyAppreciation,
  );

  const schedule = buildSimulateSchedule(inputs, monthlyRate);
  const principal = inputs.propertyValue.minus(inputs.downPayment);
  const purchaseCosts = inputs.propertyValue.times(purchaseCostPct);

  let buyPropertyValue = inputs.propertyValue;
  let buyOutstandingBalance = roundMoney(principal);
  let buyInvested = ZERO;
  let rentInvested = roundMoney(inputs.downPayment.plus(purchaseCosts));
  let currentRent = inputs.monthlyRent;

  const buyTimeline: SimulateBuyTimelineEntry[] = [
    {
      month: 0,
      propertyValue: roundMoney(buyPropertyValue),
      outstandingBalance: buyOutstandingBalance,
      paidInstallment: ZERO,
      monthlyOwnershipOutflow: ZERO,
      investedDifference: ZERO,
      netWorth: roundMoney(
        buyPropertyValue
          .times(ONE.minus(saleCostPct))
          .minus(buyOutstandingBalance)
          .plus(buyInvested),
      ),
    },
  ];
  const rentTimeline: SimulateRentTimelineEntry[] = [
    {
      month: 0,
      rentPaid: ZERO,
      monthlyContribution: ZERO,
      investedCapital: rentInvested,
      netWorth: rentInvested,
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

    const buyOutflow = installment.plus(monthlyOwnershipCosts);
    const rentOutflow = currentRent;

    let buyContribution = ZERO;
    let rentContribution = ZERO;
    const diff = rentOutflow.minus(buyOutflow);
    if (diff.greaterThan(0)) {
      buyContribution = diff;
    } else if (diff.lessThan(0)) {
      rentContribution = diff.negated();
    }

    buyInvested = buyInvested
      .times(ONE.plus(monthlyReturn))
      .plus(buyContribution);
    rentInvested = rentInvested
      .times(ONE.plus(monthlyReturn))
      .plus(rentContribution);

    buyPropertyValue = buyPropertyValue.times(ONE.plus(monthlyAppreciation));
    buyOutstandingBalance = newOutstandingBalance;

    const buyNetWorth = roundMoney(
      buyPropertyValue
        .times(ONE.minus(saleCostPct))
        .minus(buyOutstandingBalance)
        .plus(buyInvested),
    );
    const rentNetWorth = roundMoney(rentInvested);

    buyTimeline.push({
      month: m,
      propertyValue: roundMoney(buyPropertyValue),
      outstandingBalance: roundMoney(buyOutstandingBalance),
      paidInstallment: roundMoney(installment),
      monthlyOwnershipOutflow: roundMoney(buyOutflow),
      investedDifference: roundMoney(buyInvested),
      netWorth: buyNetWorth,
    });
    rentTimeline.push({
      month: m,
      rentPaid: roundMoney(currentRent),
      monthlyContribution: roundMoney(rentContribution),
      investedCapital: roundMoney(rentInvested),
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

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compatible MVP API: compareRentVsBuy
// Delegates to simulateRentVsBuy with purchaseCostPct=0 and saleCostPct=0 so
// existing callers (UI, charts, Excel) keep their semantics unchanged.
// ─────────────────────────────────────────────────────────────────────────────

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
 * @deprecated Prefer {@link simulateRentVsBuy}. This wrapper preserves the MVP
 * shape (monthlyRate input, no purchase/sale costs) by delegating to the new
 * engine with `purchaseCostPct=0` and `saleCostPct=0`. The legacy timeline
 * fields are mapped from the new engine's outputs.
 */
export function compareRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  // Validate the MVP-shape inputs that don't survive the conversion to the
  // new engine's input shape (so error messages keep the legacy field names).
  if (inputs.monthlyRate.isNegative()) {
    throw new Error("monthlyRate must be non-negative");
  }
  const annualRate = monthlyToAnnualRate(inputs.monthlyRate);
  const simResult = simulateRentVsBuy({
    propertyValue: inputs.propertyValue,
    downPayment: inputs.downPayment,
    termMonths: inputs.termMonths,
    annualRate,
    monthlyRent: inputs.monthlyRent,
    annualRentAdjustment: inputs.annualRentAdjustment,
    annualPropertyAppreciation: inputs.annualAppreciation,
    annualInvestmentReturn: inputs.annualInvestmentReturn,
    horizonMonths: inputs.horizonMonths,
    system: inputs.system,
    monthlyOwnershipCosts: inputs.monthlyOwnershipCosts,
    purchaseCostPct: ZERO,
    saleCostPct: ZERO,
  });

  const buyTimeline: BuyTimelineEntry[] = simResult.buyTimeline.map((b) => ({
    month: b.month,
    propertyValue: b.propertyValue,
    outstandingBalance: b.outstandingBalance,
    investedCapital: b.investedDifference,
    netWorth: b.netWorth,
  }));

  // Preserve MVP semantics: the legacy `rent` field at m=0 was the initial
  // monthly rent (not zero), since it represented "rent that applies to this
  // month" rather than "rent paid this month".
  const rentTimeline: RentTimelineEntry[] = simResult.rentTimeline.map(
    (r, idx) => ({
      month: r.month,
      rent: idx === 0 ? roundMoney(inputs.monthlyRent) : r.rentPaid,
      investedCapital: r.investedCapital,
      monthlyContribution: r.monthlyContribution,
      netWorth: r.netWorth,
    }),
  );

  return {
    buyTimeline,
    rentTimeline,
    summary: simResult.summary,
  };
}
