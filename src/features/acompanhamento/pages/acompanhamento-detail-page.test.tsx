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
vi.mock("@/lib/queries/tracker-plans", () => ({
  useTrackerPlan: () => useTrackerPlanMock(),
  useDeleteTrackerPlan: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
}));

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

  it("shows '—' for every KPI when there are no entries", () => {
    setDetail(makePlan(), []);
    renderPage();

    expect(
      screen.getByTestId("kpi-card-saldo-atual-value"),
    ).toHaveTextContent("—");
    expect(
      screen.getByTestId("kpi-card-juros-pagos-ate-agora-value"),
    ).toHaveTextContent("—");
    expect(
      screen.getByTestId(
        "kpi-card-economia-de-juros-vs-normal-realizado-value",
      ),
    ).toHaveTextContent("—");
    expect(
      screen.getByTestId(
        "kpi-card-meses-reduzidos-vs-normal-realizado-value",
      ),
    ).toHaveTextContent("—");
  });

  it("computes the KPIs from the curves when entries exist", () => {
    setDetail(makePlan(), [makeEntry(1), makeEntry(2), makeEntry(3)]);
    renderPage();

    expect(
      screen.getByTestId("kpi-card-saldo-atual-value"),
    ).toHaveTextContent("R$");
    expect(
      screen.getByTestId("kpi-card-juros-pagos-ate-agora-value"),
    ).toHaveTextContent("R$");
    // Extra payments cut the term, so months reduced is positive (not "—").
    const reduced = screen.getByTestId(
      "kpi-card-meses-reduzidos-vs-normal-realizado-value",
    );
    expect(reduced).not.toHaveTextContent("—");
    expect(reduced).toHaveTextContent(/m[êe]s/);
  });

  it("renders 'Editar plano' as a disabled placeholder", () => {
    setDetail(makePlan(), []);
    renderPage();

    expect(
      screen.getByRole("button", { name: "Editar plano" }),
    ).toBeDisabled();
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
