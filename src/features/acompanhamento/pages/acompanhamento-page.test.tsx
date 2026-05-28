import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AcompanhamentoPage } from "@/features/acompanhamento/pages/acompanhamento-page";
import type { TrackerPlanApi } from "@/lib/api-client";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateMock };
});

const useTrackerPlansMock = vi.fn();
vi.mock("@/lib/queries/tracker-plans", () => ({
  useTrackerPlans: () => useTrackerPlansMock(),
}));

const useSessionMock = vi.fn();
vi.mock("@/lib/queries/session", () => ({
  useSession: () => useSessionMock(),
}));

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Apartamento Centro",
    property_value_cents: 500_000_00,
    down_payment_cents: 100_000_00,
    term_months: 360,
    annual_rate_bp: 1050,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 3_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function setPlans(plans: TrackerPlanApi[]) {
  (useTrackerPlansMock as Mock).mockReturnValue({
    data: plans,
    isPending: false,
    isError: false,
    error: null,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AcompanhamentoPage />
    </MemoryRouter>,
  );
}

describe("AcompanhamentoPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useTrackerPlansMock.mockReset();
    useSessionMock.mockReset();
    useSessionMock.mockReturnValue({
      user: { id: "u_1" },
      session: {},
      isPending: false,
      isError: false,
    });
  });

  it("renders the empty state and navigates from its button", () => {
    setPlans([]);
    renderPage();

    expect(screen.getByTestId("acompanhamento-empty-state")).toBeInTheDocument();
    expect(
      screen.getByText("Você ainda não tem nenhum plano de acompanhamento."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar novo plano" }));
    expect(navigateMock).toHaveBeenCalledWith("/acompanhamento/novo");
  });

  it("always shows the 'Novo plano' header button", () => {
    setPlans([]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Novo plano" }));
    expect(navigateMock).toHaveBeenCalledWith("/acompanhamento/novo");
  });

  it("renders a card per plan and navigates to the detail on click", () => {
    setPlans([
      makePlan({ id: "tp_1", name: "Plano A" }),
      makePlan({ id: "tp_2", name: "Plano B", modality: "SAC" }),
    ]);
    renderPage();

    expect(screen.queryByTestId("acompanhamento-empty-state")).not.toBeInTheDocument();
    expect(screen.getByText("Plano A")).toBeInTheDocument();
    expect(screen.getByText("Plano B")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tracker-plan-card-tp_2"));
    expect(navigateMock).toHaveBeenCalledWith("/acompanhamento/tp_2");
  });

  it("shows a loading skeleton while the query is pending", () => {
    (useTrackerPlansMock as Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
    });
    renderPage();

    expect(screen.getByTestId("acompanhamento-loading")).toBeInTheDocument();
  });

  it("shows an error alert when the query fails", () => {
    (useTrackerPlansMock as Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("falha"),
    });
    renderPage();

    expect(screen.getByTestId("acompanhamento-error")).toBeInTheDocument();
    expect(screen.getByText("falha")).toBeInTheDocument();
  });
});
