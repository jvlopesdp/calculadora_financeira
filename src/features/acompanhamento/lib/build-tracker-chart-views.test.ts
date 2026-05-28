import { describe, expect, it } from "vitest";

import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import { buildTrackerChartViews } from "@/features/acompanhamento/lib/build-tracker-chart-views";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Plano",
    property_value_cents: 100_000_00,
    down_payment_cents: 0,
    term_months: 12,
    annual_rate_bp: 1200,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 15_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function makeEntry(
  monthIndex: number,
  overrides: Partial<TrackerEntryApi> = {},
): TrackerEntryApi {
  return {
    id: `entry_${monthIndex}`,
    plan_id: "tp_1",
    month_index: monthIndex,
    paid_amount_cents: 30_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe("buildTrackerChartViews", () => {
  it("builds two views (balance + interest) with three series when meta is valid", () => {
    const curves = buildCurves(makePlan(), []);
    const { views, metaInvalid } = buildTrackerChartViews(curves);

    expect(metaInvalid).toBe(false);
    expect(views.map((v) => v.id)).toEqual(["balance", "interest"]);
    for (const view of views) {
      expect(view.series.map((s) => s.key)).toEqual([
        "realizado",
        "normal",
        "meta",
      ]);
    }
  });

  it("styles Realizado solid, Normal dashed and Meta thin", () => {
    const curves = buildCurves(makePlan(), []);
    const [balance] = buildTrackerChartViews(curves).views;
    const [realizado, normal, meta] = balance.series;

    expect(realizado.color).toBe("var(--chart-1)");
    expect(realizado.strokeDasharray).toBeUndefined();
    expect(normal.color).toBe("var(--chart-3)");
    expect(normal.strokeDasharray).toBe("6 4");
    expect(meta.color).toBe("var(--chart-2)");
    expect(meta.strokeWidth).toBe(1.5);
  });

  it("plots one point per month from 0 (principal) to the full term", () => {
    const curves = buildCurves(makePlan(), []);
    const [balance] = buildTrackerChartViews(curves).views;

    // 12-month term → months 0..12 inclusive.
    expect(balance.data).toHaveLength(13);
    const first = balance.data[0] as unknown as {
      month: number;
      realizado: number;
      normal: number;
      meta: number;
    };
    expect(first.month).toBe(0);
    expect(first.realizado).toBeCloseTo(100_000, 0);
    expect(first.normal).toBeCloseTo(100_000, 0);
    // Normal schedule ends with a zeroed balance at the final month.
    const last = balance.data[balance.data.length - 1] as unknown as {
      normal: number;
    };
    expect(last.normal).toBeCloseTo(0, 1);
  });

  it("omits the Meta series and flags metaInvalid when the goal is below the installment", () => {
    const curves = buildCurves(makePlan({ target_monthly_total_cents: 100_00 }), []);
    const { views, metaInvalid } = buildTrackerChartViews(curves);

    expect(metaInvalid).toBe(true);
    for (const view of views) {
      expect(view.series.map((s) => s.key)).toEqual(["realizado", "normal"]);
      // No meta data key on any point.
      expect((view.data[0] as Record<string, unknown>).meta).toBeUndefined();
    }
  });

  it("adds an early-payoff marker on the Realizado curve when entries shorten the term", () => {
    // Three large reduce_term payments pay the loan off well before month 12.
    const curves = buildCurves(makePlan(), [
      makeEntry(1),
      makeEntry(2),
      makeEntry(3),
    ]);
    const { views } = buildTrackerChartViews(curves);
    const balance = views.find((v) => v.id === "balance");
    const interest = views.find((v) => v.id === "interest");

    expect(curves.realized.paidOffAtMonth).not.toBeNull();
    expect(curves.realized.paidOffAtMonth).toBeLessThan(12);

    const balanceMarker = balance?.markers?.find(
      (m) => m.color === "var(--chart-1)",
    );
    expect(balanceMarker).toBeDefined();
    expect(balanceMarker?.value).toBe(0);
    expect(balanceMarker?.label).toMatch(/^Quitado em mês \d+$/);

    const interestMarker = interest?.markers?.find(
      (m) => m.color === "var(--chart-1)",
    );
    expect(interestMarker).toBeDefined();
    expect(interestMarker?.value).toBeGreaterThan(0);
  });

  it("does not add markers when nothing pays off early", () => {
    // Meta equal-ish handled separately; here no entries + meta below term-shortening.
    const curves = buildCurves(
      makePlan({ target_monthly_total_cents: 100_00 }),
      [],
    );
    const { views } = buildTrackerChartViews(curves);
    for (const view of views) {
      expect(view.markers).toEqual([]);
    }
  });
});
