import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AcompanhamentoDetailPage } from "@/features/acompanhamento/pages/acompanhamento-detail-page";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: "tp_1" }),
  };
});

const useTrackerPlanMock = vi.fn();
const deleteMutateAsync = vi.fn();
const upsertEntryMutateAsync = vi.fn();
vi.mock("@/lib/queries/tracker-plans", () => ({
  useTrackerPlan: () => useTrackerPlanMock(),
  useDeleteTrackerPlan: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
  // The spreadsheet and the what-if dialog (both rendered by the page) share
  // the same entry mutations — keep a stable mock so the page-level tests can
  // assert the unified resource is hit on "Aplicar este lançamento".
  useUpsertTrackerEntry: () => ({
    mutateAsync: upsertEntryMutateAsync,
    isPending: false,
  }),
  useDeleteTrackerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The comparative chart renders recharts (needs ResizeObserver); stub it out so
// this page test stays focused on header/KPIs/spreadsheet/delete behaviour.
vi.mock("@/features/acompanhamento/components/tracker-curves-chart", () => ({
  TrackerCurvesChart: () => <div data-testid="tracker-curves-chart" />,
}));

// The what-if dialog and the spreadsheet both render Radix Select, which
// depends on portals/pointer-capture APIs jsdom doesn't ship — swap for the
// project's standard native-<select> mock.
vi.mock("@/components/ui/select", async () => {
  const mod = await import("@/tests/select-mock");
  return mod.selectMock;
});

// Passthrough Dialog so the confirmation content renders when `open` is true,
// avoiding the Radix portal dance in jsdom.
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
    paid_amount_cents: 10_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

function setDetail(plan: TrackerPlanApi, entries: TrackerEntryApi[]) {
  (useTrackerPlanMock as Mock).mockReturnValue({
    data: { plan, entries },
    isPending: false,
    isError: false,
    error: null,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AcompanhamentoDetailPage />
    </MemoryRouter>,
  );
}

describe("AcompanhamentoDetailPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    deleteMutateAsync.mockReset();
    upsertEntryMutateAsync.mockReset();
    useTrackerPlanMock.mockReset();
  });

  it("renders the read-only header with plan metadata", () => {
    setDetail(makePlan({ name: "Plano X" }), []);
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Plano X" }),
    ).toBeInTheDocument();
    // Scope to the toolbar: the spreadsheet rows also render dates/metadata.
    const toolbar = within(screen.getByTestId("acompanhamento-detail-toolbar"));
    expect(toolbar.getByText(/PRICE/)).toBeInTheDocument();
    expect(toolbar.getByText(/12 meses/)).toBeInTheDocument();
    expect(toolbar.getByText(/01\/01\/2025/)).toBeInTheDocument();
  });

  it("shows '—' with the empty-state hint for every KPI when there are no entries", () => {
    setDetail(makePlan(), []);
    renderPage();

    for (const slug of [
      "ja-pago",
      "saldo-devedor",
      "parcelas-restantes",
      "juros-pagos-ate-agora",
      "economia-vs-cronograma-original",
      "prazo-reduzido",
    ]) {
      expect(
        screen.getByTestId(`kpi-card-${slug}-value`),
      ).toHaveTextContent("—");
    }
    // The hint text appears once per placeholder (six cards).
    expect(
      screen.getAllByText(/Registre lançamentos/i),
    ).toHaveLength(6);
  });

  it("computes the KPIs from the curves when entries exist", () => {
    setDetail(makePlan(), [makeEntry(1), makeEntry(2), makeEntry(3)]);
    renderPage();

    expect(
      screen.getByTestId("kpi-card-saldo-devedor-value"),
    ).toHaveTextContent("R$");
    expect(
      screen.getByTestId("kpi-card-juros-pagos-ate-agora-value"),
    ).toHaveTextContent("R$");
    expect(
      screen.getByTestId("kpi-card-ja-pago-value"),
    ).toHaveTextContent("%");
    expect(
      screen.getByTestId("kpi-card-parcelas-restantes-value"),
    ).toHaveTextContent(/^\d+$/);
    // Extra payments cut the term, so prazo reduzido is positive (not "—").
    const reduced = screen.getByTestId("kpi-card-prazo-reduzido-value");
    expect(reduced).not.toHaveTextContent("—");
    expect(reduced).toHaveTextContent(/m[êe]s/);
  });

  it("renders the Previsto x Real chart wired with the loaded detail", () => {
    setDetail(makePlan(), [makeEntry(1), makeEntry(2)]);
    renderPage();
    expect(screen.getByTestId("tracker-curves-chart")).toBeInTheDocument();
  });

  // US-013: KPIs and chart recompute the moment the plan detail cache
  // changes — i.e. a save/edit/delete from `useUpsertTrackerEntry` /
  // `useDeleteTrackerEntry` updates the cache and the page reflects it
  // without any reload, because both `curves` and `kpis` are derived via
  // `useMemo([detail])` / `useMemo([curves])`.
  it("recomputes KPIs and re-renders the chart when entries change without reloading", () => {
    setDetail(makePlan(), []);
    const view = renderPage();

    // Empty state: every KPI is "—" and the chart is on screen.
    expect(
      screen.getByTestId("kpi-card-saldo-devedor-value"),
    ).toHaveTextContent("—");
    expect(
      screen.getByTestId("kpi-card-ja-pago-value"),
    ).toHaveTextContent("—");
    expect(screen.getByTestId("tracker-curves-chart")).toBeInTheDocument();

    // Cache mutation: entries appear (mirrors what an optimistic upsert does).
    setDetail(makePlan(), [makeEntry(1), makeEntry(2), makeEntry(3)]);
    view.rerender(
      <MemoryRouter>
        <AcompanhamentoDetailPage />
      </MemoryRouter>,
    );

    // Same KPI cards now carry computed values (no "—"), and the chart is
    // still mounted (it received the recomputed `curves` as a prop).
    const saldo = screen.getByTestId("kpi-card-saldo-devedor-value");
    expect(saldo).not.toHaveTextContent("—");
    expect(saldo).toHaveTextContent("R$");
    const jaPago = screen.getByTestId("kpi-card-ja-pago-value");
    expect(jaPago).not.toHaveTextContent("—");
    expect(jaPago).toHaveTextContent("%");
    expect(screen.getByTestId("tracker-curves-chart")).toBeInTheDocument();
  });

  it("renders 'Editar plano' as a disabled placeholder", () => {
    setDetail(makePlan(), []);
    renderPage();

    expect(
      screen.getByRole("button", { name: "Editar plano" }),
    ).toBeDisabled();
  });

  // US-014: the "Simular antecipação" button on the new tab opens the
  // non-persistent what-if simulation dialog. The simulation runs entirely in
  // memory until the user clicks "Aplicar este lançamento", which then creates
  // the real entry via the unified resource (`useUpsertTrackerEntry` →
  // `POST /api/tracker/plans/:id/entries`).
  it("opens the what-if simulation dialog from 'Simular antecipação' without persisting", () => {
    setDetail(makePlan(), []);
    renderPage();

    expect(
      screen.queryByRole("heading", { name: "Simular antecipação" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Simular antecipação" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Simular antecipação" }),
    ).toBeInTheDocument();
    // Just opening the dialog must not persist anything.
    expect(upsertEntryMutateAsync).not.toHaveBeenCalled();
  });

  it("creates the real entry via the unified resource when the simulation is applied", async () => {
    upsertEntryMutateAsync.mockResolvedValue({});
    setDetail(makePlan(), []);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Simular antecipação" }),
    );

    const dialog = screen.getByRole("dialog");
    // Override the suggested installment with a big anticipation so the
    // simulation has an effect to show.
    fireEvent.change(within(dialog).getByLabelText("Valor"), {
      target: { value: "60000" },
    });
    // The result preview is purely client-side — still no API call yet.
    expect(
      within(dialog).getByTestId("tracker-what-if-result"),
    ).toBeInTheDocument();
    expect(upsertEntryMutateAsync).not.toHaveBeenCalled();

    // Confirm: the page's wired-up mutation creates the entry.
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Aplicar este lançamento",
        }),
      );
    });

    expect(upsertEntryMutateAsync).toHaveBeenCalledWith({
      month_index: 1,
      paid_amount: 60000,
      paid_at: "2025-01-01",
      apply_mode: "reduce_term",
    });
  });

  it("deletes the plan and navigates back after confirmation", async () => {
    const plan = makePlan();
    deleteMutateAsync.mockResolvedValue(plan);
    setDetail(plan, []);
    renderPage();

    // Only the header button exists before opening the dialog.
    fireEvent.click(screen.getByRole("button", { name: "Excluir plano" }));

    const dialog = screen.getByRole("dialog");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Excluir plano" }),
      );
    });

    expect(deleteMutateAsync).toHaveBeenCalledWith("tp_1");
    expect(navigateMock).toHaveBeenCalledWith("/acompanhamento");
  });
});
