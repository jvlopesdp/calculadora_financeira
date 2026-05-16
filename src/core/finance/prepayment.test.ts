import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentScheduleRow,
} from "./prepayment";
import { generatePriceSchedule, generateSacSchedule } from "./amortization";
import type { FinancingInputs } from "./financial-types";

const ONE_CENT = new Decimal("0.01");

const STANDARD_INPUTS = {
  principal: new Decimal(300000),
  monthlyRate: new Decimal("0.008"),
  termMonths: 360,
} as const satisfies Omit<FinancingInputs, "system">;

function withSystem(
  system: "PRICE" | "SAC",
): FinancingInputs {
  return { ...STANDARD_INPUTS, system };
}

function sum(
  rows: PrepaymentScheduleRow[],
  field: "installment" | "interest" | "amortization" | "extraPayment",
): Decimal {
  return rows.reduce((acc, row) => acc.plus(row[field]), new Decimal(0));
}

describe("applyPrepaymentReduceTerm", () => {
  describe("PRICE + R$ 500 extra monthly payment", () => {
    const result = applyPrepaymentReduceTerm(
      withSystem("PRICE"),
      new Decimal(500),
    );
    const { schedule, summary } = result;

    it("shortens the term below the original", () => {
      expect(summary.newTermMonths).toBeLessThan(summary.originalTermMonths);
      expect(summary.monthsReduced).toBe(
        summary.originalTermMonths - summary.newTermMonths,
      );
    });

    it("drives the final balance to zero", () => {
      const last = schedule[schedule.length - 1]!;
      expect(last.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
      expect(last.balance.equals(0)).toBe(true);
    });

    it("keeps a constant base + extra installment for every non-final month", () => {
      const basePlusExtra = schedule[0]!.installment;
      for (let i = 0; i < schedule.length - 1; i++) {
        expect(schedule[i]!.installment.equals(basePlusExtra)).toBe(true);
        expect(schedule[i]!.extraPayment.equals(500)).toBe(true);
      }
    });

    it("totals reconcile: installment = interest + amortization per row", () => {
      for (const row of schedule) {
        expect(row.interest.plus(row.amortization).equals(row.installment)).toBe(
          true,
        );
      }
    });

    it("sum of amortizations equals the principal", () => {
      expect(sum(schedule, "amortization").equals(300000)).toBe(true);
    });

    it("interestSaved is positive vs. the base PRICE schedule", () => {
      expect(summary.interestSaved.greaterThan(0)).toBe(true);
    });

    it("totalPaid equals totalInterest + principal", () => {
      expect(summary.totalPaid.equals(summary.totalInterest.plus(300000))).toBe(
        true,
      );
    });
  });

  describe("SAC + R$ 500 extra monthly payment", () => {
    const result = applyPrepaymentReduceTerm(
      withSystem("SAC"),
      new Decimal(500),
    );
    const { schedule, summary } = result;

    it("shortens the term below the original", () => {
      expect(summary.newTermMonths).toBeLessThan(summary.originalTermMonths);
    });

    it("drives the final balance to zero", () => {
      const last = schedule[schedule.length - 1]!;
      expect(last.balance.equals(0)).toBe(true);
    });

    it("amortization equals base SAC amortization + extra for non-final rows", () => {
      const baseAmortization = new Decimal("833.33");
      for (let i = 0; i < schedule.length - 1; i++) {
        expect(
          schedule[i]!.amortization.equals(baseAmortization.plus(500)),
        ).toBe(true);
      }
    });

    it("interest decreases monotonically across non-final rows", () => {
      for (let i = 1; i < schedule.length - 1; i++) {
        expect(
          schedule[i]!.interest.lessThan(schedule[i - 1]!.interest),
        ).toBe(true);
      }
    });

    it("sum of amortizations equals the principal", () => {
      expect(sum(schedule, "amortization").equals(300000)).toBe(true);
    });

    it("interestSaved is positive vs. the base SAC schedule", () => {
      expect(summary.interestSaved.greaterThan(0)).toBe(true);
    });
  });
});

describe("applyPrepaymentReduceInstallment", () => {
  describe("PRICE + R$ 500 extra monthly payment", () => {
    const result = applyPrepaymentReduceInstallment(
      withSystem("PRICE"),
      new Decimal(500),
    );
    const { schedule, summary } = result;

    it("does not extend the loan beyond the original term", () => {
      expect(summary.newTermMonths).toBeLessThanOrEqual(
        summary.originalTermMonths,
      );
      expect(summary.monthsReduced).toBe(
        summary.originalTermMonths - summary.newTermMonths,
      );
    });

    it("drives the final balance to zero", () => {
      const last = schedule[schedule.length - 1]!;
      expect(last.balance.equals(0)).toBe(true);
    });

    it("records the extra payment on every non-final month", () => {
      for (let i = 0; i < schedule.length - 1; i++) {
        expect(schedule[i]!.extraPayment.equals(500)).toBe(true);
      }
    });

    it("installment shrinks over time (non-increasing) for non-final months", () => {
      for (let i = 1; i < schedule.length - 1; i++) {
        expect(
          schedule[i]!.installment.lessThanOrEqualTo(
            schedule[i - 1]!.installment,
          ),
        ).toBe(true);
      }
    });

    it("interestSaved is positive vs. the base PRICE schedule", () => {
      expect(summary.interestSaved.greaterThan(0)).toBe(true);
    });

    it("sum of amortizations equals the principal", () => {
      expect(sum(schedule, "amortization").equals(300000)).toBe(true);
    });
  });

  describe("SAC + R$ 500 extra monthly payment", () => {
    const result = applyPrepaymentReduceInstallment(
      withSystem("SAC"),
      new Decimal(500),
    );
    const { schedule, summary } = result;

    it("does not extend the loan beyond the original term", () => {
      expect(summary.newTermMonths).toBeLessThanOrEqual(
        summary.originalTermMonths,
      );
    });

    it("drives the final balance to zero", () => {
      const last = schedule[schedule.length - 1]!;
      expect(last.balance.equals(0)).toBe(true);
    });

    it("installment decreases over time (non-increasing)", () => {
      for (let i = 1; i < schedule.length - 1; i++) {
        expect(
          schedule[i]!.installment.lessThanOrEqualTo(
            schedule[i - 1]!.installment,
          ),
        ).toBe(true);
      }
    });

    it("interestSaved is positive vs. the base SAC schedule", () => {
      expect(summary.interestSaved.greaterThan(0)).toBe(true);
    });

    it("sum of amortizations equals the principal", () => {
      expect(sum(schedule, "amortization").equals(300000)).toBe(true);
    });
  });
});

describe("zero-extra-payment passthrough matches base schedule exactly", () => {
  it("reduce-term × PRICE matches generatePriceSchedule row-for-row", () => {
    const base = generatePriceSchedule(withSystem("PRICE"));
    const result = applyPrepaymentReduceTerm(withSystem("PRICE"), new Decimal(0));
    expect(result.schedule).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      const a = base[i]!;
      const b = result.schedule[i]!;
      expect(b.month).toBe(a.month);
      expect(b.installment.equals(a.installment)).toBe(true);
      expect(b.interest.equals(a.interest)).toBe(true);
      expect(b.amortization.equals(a.amortization)).toBe(true);
      expect(b.balance.equals(a.balance)).toBe(true);
      expect(b.extraPayment.equals(0)).toBe(true);
    }
    expect(result.summary.interestSaved.equals(0)).toBe(true);
    expect(result.summary.monthsReduced).toBe(0);
  });

  it("reduce-term × SAC matches generateSacSchedule row-for-row", () => {
    const base = generateSacSchedule(withSystem("SAC"));
    const result = applyPrepaymentReduceTerm(withSystem("SAC"), new Decimal(0));
    expect(result.schedule).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      const a = base[i]!;
      const b = result.schedule[i]!;
      expect(b.installment.equals(a.installment)).toBe(true);
      expect(b.interest.equals(a.interest)).toBe(true);
      expect(b.amortization.equals(a.amortization)).toBe(true);
      expect(b.balance.equals(a.balance)).toBe(true);
      expect(b.extraPayment.equals(0)).toBe(true);
    }
    expect(result.summary.interestSaved.equals(0)).toBe(true);
  });

  it("reduce-installment × PRICE matches generatePriceSchedule row-for-row", () => {
    const base = generatePriceSchedule(withSystem("PRICE"));
    const result = applyPrepaymentReduceInstallment(
      withSystem("PRICE"),
      new Decimal(0),
    );
    expect(result.schedule).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(result.schedule[i]!.installment.equals(base[i]!.installment)).toBe(
        true,
      );
      expect(result.schedule[i]!.balance.equals(base[i]!.balance)).toBe(true);
      expect(result.schedule[i]!.extraPayment.equals(0)).toBe(true);
    }
  });

  it("reduce-installment × SAC matches generateSacSchedule row-for-row", () => {
    const base = generateSacSchedule(withSystem("SAC"));
    const result = applyPrepaymentReduceInstallment(
      withSystem("SAC"),
      new Decimal(0),
    );
    expect(result.schedule).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(result.schedule[i]!.installment.equals(base[i]!.installment)).toBe(
        true,
      );
      expect(result.schedule[i]!.balance.equals(base[i]!.balance)).toBe(true);
      expect(result.schedule[i]!.extraPayment.equals(0)).toBe(true);
    }
  });
});

describe("validation", () => {
  it("rejects a negative extra payment", () => {
    expect(() =>
      applyPrepaymentReduceTerm(withSystem("PRICE"), new Decimal(-1)),
    ).toThrow(/extraMonthly/);
    expect(() =>
      applyPrepaymentReduceInstallment(withSystem("PRICE"), new Decimal(-1)),
    ).toThrow(/extraMonthly/);
  });

  it("rejects a non-positive term", () => {
    expect(() =>
      applyPrepaymentReduceTerm(
        { ...withSystem("PRICE"), termMonths: 0 },
        new Decimal(0),
      ),
    ).toThrow(/termMonths/);
  });
});

describe("PRICE reduce-installment vs reduce-term invariants", () => {
  const reduceTerm = applyPrepaymentReduceTerm(
    withSystem("PRICE"),
    new Decimal(500),
  );
  const reduceInstallment = applyPrepaymentReduceInstallment(
    withSystem("PRICE"),
    new Decimal(500),
  );

  it("reduce-term ends earlier than reduce-installment", () => {
    expect(reduceTerm.summary.newTermMonths).toBeLessThan(
      reduceInstallment.summary.newTermMonths,
    );
  });

  it("reduce-term saves more interest than reduce-installment for the same extra", () => {
    expect(
      reduceTerm.summary.interestSaved.greaterThan(
        reduceInstallment.summary.interestSaved,
      ),
    ).toBe(true);
  });
});
