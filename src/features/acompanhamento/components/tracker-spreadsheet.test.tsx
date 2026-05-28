import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrackerSpreadsheet } from "@/features/acompanhamento/components/tracker-spreadsheet";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Apartamento Centro",
    property_value_cents: 100_000_00,
    down_payment_cents: 0,
    term_months: 12,
    annual_rate_bp: 1200,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 10_000_00,
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
    paid_amount_cents: 60_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

function renderSpreadsheet(plan: TrackerPlanApi, entries: TrackerEntryApi[]) {
  const curves = buildCurves(plan, entries);
  return render(
    <TrackerSpreadsheet plan={plan} entries={entries} curves={curves} />,
  );
}

function dataRows(): HTMLTableRowElement[] {
  return Array.from(
    document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]"),
  );
}

describe("TrackerSpreadsheet", () => {
  it("renders one row per month and marks settled rows as 'Quitado'", () => {
    // Two large early payments settle the plan before month 12.
    const plan = makePlan();
    renderSpreadsheet(plan, [makeEntry(1), makeEntry(2)]);

    // term_months rows are present (pageSize 24 fits a 12-month plan).
    expect(dataRows()).toHaveLength(plan.term_months);

    // The early payoff leaves trailing months flagged as "Quitado".
    const quitado = screen.getAllByText("Quitado");
    expect(quitado.length).toBeGreaterThan(0);
  });

  it("shows the Normal schedule with '—' for unpaid months when there are no entries", () => {
    const plan = makePlan();
    renderSpreadsheet(plan, []);

    expect(dataRows()).toHaveLength(plan.term_months);
    // No payoff curtailment without entries → no "Quitado" rows.
    expect(screen.queryByText("Quitado")).not.toBeInTheDocument();

    // First row: month 1, due on the start date, "Pago"/"Modo"/"Nota" all "—".
    const firstRow = dataRows()[0];
    expect(within(firstRow).getByText("01/01/2025")).toBeInTheDocument();
    expect(within(firstRow).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("formats the due date by advancing the month from the plan start date", () => {
    const plan = makePlan({ start_date: "2025-01-15", term_months: 14 });
    renderSpreadsheet(plan, []);

    const rows = dataRows();
    // Month 2 → February, month 13 → January of the next year.
    expect(within(rows[1]).getByText("15/02/2025")).toBeInTheDocument();
    expect(within(rows[12]).getByText("15/01/2026")).toBeInTheDocument();
  });
});
