import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackerSpreadsheet } from "@/features/acompanhamento/components/tracker-spreadsheet";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import {
  trackerPlanQueryKey,
  useTrackerPlan,
} from "@/lib/queries/tracker-plans";
import type {
  TrackerEntryApi,
  TrackerPlanApi,
  TrackerPlanDetail,
} from "@/lib/api-client";

// Radix Select uses portals / pointer-capture APIs that don't work in jsdom.
// Render a native <select> instead so fireEvent.change keeps working.
vi.mock("@/components/ui/select", async () => {
  const mod = await import("@/tests/select-mock");
  return mod.selectMock;
});

// Passthrough Dialog so the delete confirmation renders when `open`, dodging
// the Radix portal in jsdom.
vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
  };
});

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

function newClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

/** Renders the spreadsheet with fixed props (no cache-driven re-render). */
function renderSpreadsheet(
  plan: TrackerPlanApi,
  entries: TrackerEntryApi[],
  qc: QueryClient = newClient(),
) {
  const curves = buildCurves(plan, entries);
  return render(
    <QueryClientProvider client={qc}>
      <TrackerSpreadsheet plan={plan} entries={entries} curves={curves} />
    </QueryClientProvider>,
  );
}

/**
 * Renders the spreadsheet driven by the plan-detail cache (like the detail
 * page) so optimistic mutations re-render the curves.
 */
function CacheHarness({ plan }: { plan: TrackerPlanApi }) {
  const { data } = useTrackerPlan(plan.id);
  if (!data) return null;
  const curves = buildCurves(data.plan, data.entries);
  return (
    <TrackerSpreadsheet plan={data.plan} entries={data.entries} curves={curves} />
  );
}

function dataRows(): HTMLTableRowElement[] {
  return Array.from(
    document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]"),
  );
}

describe("TrackerSpreadsheet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders one row per month and marks settled rows as 'Quitado'", () => {
    const plan = makePlan();
    renderSpreadsheet(plan, [makeEntry(1), makeEntry(2)]);

    expect(dataRows()).toHaveLength(plan.term_months);
    expect(screen.getAllByText("Quitado").length).toBeGreaterThan(0);
  });

  it("renders editable Pago/Modo controls for open months", () => {
    const plan = makePlan();
    renderSpreadsheet(plan, []);

    expect(dataRows()).toHaveLength(plan.term_months);
    expect(screen.queryByText("Quitado")).not.toBeInTheDocument();

    // Month 1 has an editable currency field and a mode <select>.
    expect(screen.getByLabelText("Valor pago no mês 1")).toBeEnabled();
    const modeSelect = screen.getByLabelText("Modo do mês 1");
    expect(modeSelect).toBeEnabled();
    expect(within(modeSelect).getByText("Reduzir prazo")).toBeInTheDocument();
  });

  it("formats the due date by advancing the month from the plan start date", () => {
    const plan = makePlan({ start_date: "2025-01-15", term_months: 14 });
    renderSpreadsheet(plan, []);

    const rows = dataRows();
    expect(within(rows[1]).getByText("15/02/2025")).toBeInTheDocument();
    expect(within(rows[12]).getByText("15/01/2026")).toBeInTheDocument();
  });

  it("disables inputs on rows after early payoff", () => {
    const plan = makePlan();
    // A huge month-1 payment settles the loan immediately.
    renderSpreadsheet(plan, [makeEntry(1, { paid_amount_cents: 600_000_00 })]);

    // Month 12 sits after the payoff → its inputs are blocked.
    expect(screen.getByLabelText("Valor pago no mês 12")).toBeDisabled();
    expect(screen.getByLabelText("Modo do mês 12")).toBeDisabled();
  });

  it("blocks a payment below the scheduled installment without calling the API", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const plan = makePlan();
    renderSpreadsheet(plan, []);

    const paidInput = screen.getByLabelText("Valor pago no mês 1");
    fireEvent.change(paidInput, { target: { value: "1,00" } });

    const row1 = dataRows()[0];
    fireEvent.click(within(row1).getByRole("button", { name: "Salvar" }));

    expect(within(row1).getByRole("alert")).toHaveTextContent(
      /parcela prevista/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("updates the following balance after a successful save", async () => {
    const plan = makePlan();
    const qc = newClient();
    qc.setQueryData<TrackerPlanDetail>(trackerPlanQueryKey(plan.id), {
      plan,
      entries: [],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          entry: makeEntry(1, {
            id: "real_1",
            paid_amount_cents: 600_000_00,
          }),
        }),
      })),
    );

    render(
      <QueryClientProvider client={qc}>
        <CacheHarness plan={plan} />
      </QueryClientProvider>,
    );

    // No early payoff before the edit.
    expect(screen.queryByText("Quitado")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Valor pago no mês 1"), {
      target: { value: "600000" },
    });
    fireEvent.click(
      within(dataRows()[0]).getByRole("button", { name: "Salvar" }),
    );

    // The huge payment pays the loan off → later months become "Quitado".
    await waitFor(() =>
      expect(screen.getAllByText("Quitado").length).toBeGreaterThan(0),
    );
  });

  it("reverts the optimistic balance and surfaces an error on a 422", async () => {
    const plan = makePlan();
    const qc = newClient();
    qc.setQueryData<TrackerPlanDetail>(trackerPlanQueryKey(plan.id), {
      plan,
      entries: [],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          error: "validation",
          message: "Valor inválido para o mês.",
        }),
      })),
    );

    render(
      <QueryClientProvider client={qc}>
        <CacheHarness plan={plan} />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Valor pago no mês 1"), {
      target: { value: "600000" },
    });
    fireEvent.click(
      within(dataRows()[0]).getByRole("button", { name: "Salvar" }),
    );

    // Error surfaced and the optimistic payoff was rolled back.
    await waitFor(() =>
      expect(
        screen.getByTestId("tracker-spreadsheet-error"),
      ).toHaveTextContent("Valor inválido para o mês."),
    );
    expect(screen.queryByText("Quitado")).not.toBeInTheDocument();
  });

  it("deletes an entry after confirmation", async () => {
    const plan = makePlan();
    const qc = newClient();
    qc.setQueryData<TrackerPlanDetail>(trackerPlanQueryKey(plan.id), {
      plan,
      entries: [makeEntry(1, { paid_amount_cents: 10_000_00 })],
    });

    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        entry: makeEntry(1, { paid_amount_cents: 10_000_00 }),
      }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <QueryClientProvider client={qc}>
        <CacheHarness plan={plan} />
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Excluir lançamento do mês 1" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Excluir lançamento" }),
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("/api/tracker/plans/tp_1/entries/entry_1");
    expect(init.method).toBe("DELETE");
  });
});
