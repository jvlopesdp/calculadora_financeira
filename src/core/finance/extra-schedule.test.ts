import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
} from "@/core/finance/prepayment";
import { resolveExtraSchedule } from "@/core/finance/extra-schedule";
import type { FinancingInputs } from "@/core/finance/financial-types";

const priceInputs: FinancingInputs = {
  principal: new Decimal(400_000),
  monthlyRate: new Decimal("0.01"),
  termMonths: 360,
  system: "PRICE",
};

const sacInputs: FinancingInputs = {
  ...priceInputs,
  system: "SAC",
};

describe("resolveExtraSchedule", () => {
  it("for PRICE + extra > 0 returns the same schedule the prepayment engine would for reduce-term", () => {
    const extra = new Decimal(1_000);
    const viaTarget = resolveExtraSchedule(priceInputs, extra, "term");
    const direct = applyPrepaymentReduceTerm(priceInputs, extra);
    expect(viaTarget.schedule).toHaveLength(direct.schedule.length);
    for (let i = 0; i < direct.schedule.length; i++) {
      const a = viaTarget.schedule[i];
      const b = direct.schedule[i];
      expect(a.installment.toString()).toBe(b.installment.toString());
      expect(a.interest.toString()).toBe(b.interest.toString());
      expect(a.amortization.toString()).toBe(b.amortization.toString());
      expect(a.balance.toString()).toBe(b.balance.toString());
    }
  });

  it("for PRICE + extra > 0 returns the same schedule for reduce-installment", () => {
    const extra = new Decimal(1_000);
    const viaTarget = resolveExtraSchedule(priceInputs, extra, "installment");
    const direct = applyPrepaymentReduceInstallment(priceInputs, extra);
    expect(viaTarget.schedule).toHaveLength(direct.schedule.length);
    for (let i = 0; i < direct.schedule.length; i++) {
      expect(viaTarget.schedule[i].installment.toString()).toBe(
        direct.schedule[i].installment.toString(),
      );
    }
  });

  it("for PRICE + zero extra returns the base schedule (length === termMonths)", () => {
    const result = resolveExtraSchedule(priceInputs, new Decimal(0), "term");
    expect(result.schedule.length).toBe(priceInputs.termMonths);
  });

  it("for SAC falls back to the prepayment engine directly", () => {
    const extra = new Decimal(500);
    const viaHelper = resolveExtraSchedule(sacInputs, extra, "term");
    const direct = applyPrepaymentReduceTerm(sacInputs, extra);
    expect(viaHelper.schedule.length).toBe(direct.schedule.length);
    expect(viaHelper.summary.totalPaid.toString()).toBe(
      direct.summary.totalPaid.toString(),
    );
  });

  it("for SAC + reduce-installment falls back to the prepayment engine", () => {
    const extra = new Decimal(500);
    const viaHelper = resolveExtraSchedule(sacInputs, extra, "installment");
    const direct = applyPrepaymentReduceInstallment(sacInputs, extra);
    expect(viaHelper.summary.totalInterest.toString()).toBe(
      direct.summary.totalInterest.toString(),
    );
  });
});
