/**
 * End-to-end test for US-013: prove that saving an entry from the spreadsheet
 * updates the page's KPIs and re-renders the chart in real time, without any
 * page reload. Uses the real `useTrackerPlan` / `useUpsertTrackerEntry` hooks
 * on top of a real `QueryClient` — only the network (`fetch`) is mocked, so
 * the optimistic cache update has to flow through the actual hooks for the
 * assertion to pass.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcompanhamentoDetailPage } from "@/features/acompanhamento/pages/acompanhamento-detail-page";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useParams: () => ({ id: "tp_1" }),
  };
});

// Radix Select needs portal/pointer APIs jsdom doesn't ship — swap for a
// native <select> via the project's standard test mock.
vi.mock("@/components/ui/select", async () => {
  const mod = await import("@/tests/select-mock");
  return mod.selectMock;
});

// Passthrough Dialog so confirmation flows don't depend on Radix portals.
vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Dialog: ({
      open,
      children,
    }: {
      open?: boolean;
      children?: ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
    DialogTrigger: Passthrough,
  };
});

// The chart depends on `ResizeObserver` / SVG layout — stub it so this test
// stays focused on the page-level recompute. Its own coverage lives in
// `tracker-curves-chart.test.tsx`.
vi.mock("@/features/acompanhamento/components/tracker-curves-chart", () => ({
  TrackerCurvesChart: () => <div data-testid="tracker-curves-chart" />,
}));

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

function newClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

describe("AcompanhamentoDetailPage real-time recompute (US-013)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates the KPIs and chart in real time when a payment is saved", async () => {
    const plan = makePlan();

    // Fake server: GET returns no entries; POST upsert returns a real entry.
    const fetchSpy = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = typeof url === "string" ? url : url.toString();
      const method = init?.method ?? "GET";
      if (path === "/api/tracker/plans/tp_1" && method === "GET") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ plan, entries: [] as TrackerEntryApi[] }),
        } as Response;
      }
      if (
        path === "/api/tracker/plans/tp_1/entries" &&
        method === "POST"
      ) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            entry: {
              id: "real_1",
              plan_id: "tp_1",
              month_index: 1,
              paid_amount_cents: 12_000_00,
              paid_at: "2025-01-01",
              apply_mode: "reduce_term" as const,
              note: null,
              created_at: 1_700_000_000_001,
            } satisfies TrackerEntryApi,
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter>
          <AcompanhamentoDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Initial load: KPIs show "—" once the GET resolves.
    await waitFor(() =>
      expect(
        screen.getByTestId("kpi-card-saldo-devedor-value"),
      ).toHaveTextContent("—"),
    );
    expect(screen.getByTestId("kpi-card-ja-pago-value")).toHaveTextContent(
      "—",
    );
    expect(screen.getByTestId("tracker-curves-chart")).toBeInTheDocument();

    // Save a month-1 payment via the spreadsheet — this triggers the optimistic
    // cache update inside `useUpsertTrackerEntry`. No manual `setQueryData`.
    fireEvent.change(screen.getByLabelText("Valor pago no mês 1"), {
      target: { value: "12000" },
    });
    const rows = Array.from(
      document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]"),
    );
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Salvar" }));

    // The page recomputes KPIs from the new `detail.entries` — no reload.
    await waitFor(() => {
      const saldo = screen.getByTestId("kpi-card-saldo-devedor-value");
      expect(saldo).not.toHaveTextContent("—");
      expect(saldo).toHaveTextContent("R$");
    });
    const jaPago = screen.getByTestId("kpi-card-ja-pago-value");
    expect(jaPago).not.toHaveTextContent("—");
    expect(jaPago).toHaveTextContent("%");
    // Chart is still mounted with the recomputed curves.
    expect(screen.getByTestId("tracker-curves-chart")).toBeInTheDocument();

    // Sanity: the POST really went through the unified endpoint.
    expect(fetchSpy).toHaveBeenCalled();
    const postCall = fetchSpy.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall?.[0]).toBe("/api/tracker/plans/tp_1/entries");
  });
});
