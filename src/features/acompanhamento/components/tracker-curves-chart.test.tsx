import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrackerCurvesChart } from "@/features/acompanhamento/components/tracker-curves-chart";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const entry = {
      target,
      contentRect: { width: 600, height: 300, top: 0, right: 600, bottom: 300, left: 0, x: 0, y: 0, toJSON: () => ({}) },
      borderBoxSize: [{ inlineSize: 600, blockSize: 300 }],
      contentBoxSize: [{ inlineSize: 600, blockSize: 300 }],
      devicePixelContentBoxSize: [{ inlineSize: 600, blockSize: 300 }],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

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

function makeEntry(monthIndex: number): TrackerEntryApi {
  return {
    id: `entry_${monthIndex}`,
    plan_id: "tp_1",
    month_index: monthIndex,
    paid_amount_cents: 12_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
  };
}

describe("TrackerCurvesChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the three series and no warning when the plan + entries are valid", () => {
    const curves = buildCurves(makePlan(), [
      makeEntry(1),
      makeEntry(2),
      makeEntry(3),
    ]);
    render(<TrackerCurvesChart curves={curves} />);

    // The chart canvas is present and both axis-views are selectable.
    expect(screen.getByTestId("chart-area-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("chart-area-view-tabs")).toBeInTheDocument();

    // Legend renders all three curve names.
    expect(screen.getByText("Realizado")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Meta")).toBeInTheDocument();

    expect(
      screen.queryByTestId("tracker-curves-meta-warning"),
    ).not.toBeInTheDocument();
  });

  it("shows the meta warning and drops the Meta series when the goal is below the installment", () => {
    const curves = buildCurves(
      makePlan({ target_monthly_total_cents: 100_00 }),
      [],
    );
    render(<TrackerCurvesChart curves={curves} />);

    expect(
      screen.getByTestId("tracker-curves-meta-warning"),
    ).toHaveTextContent(/Valor-meta menor que a parcela inicial/i);

    expect(screen.getByText("Realizado")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.queryByText("Meta")).not.toBeInTheDocument();
  });
});
