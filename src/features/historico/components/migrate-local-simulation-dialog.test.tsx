import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { MigrateLocalSimulationDialog } from "@/features/historico/components/migrate-local-simulation-dialog";
import {
  LEGACY_SIMULATION_KEY,
  MIGRATION_DONE_KEY,
} from "@/lib/local-simulation-migration";
import { ApiError, type ScenarioApi } from "@/lib/api-client";

const useSessionMock = vi.fn();
const createScenarioMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => useSessionMock() },
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    createScenario: (...args: unknown[]) => createScenarioMock(...args),
  };
});

vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Dialog: ({
      open,
      children,
      onOpenChange,
    }: {
      open?: boolean;
      children?: ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) =>
      open ? (
        <div role="dialog" data-testid="migration-dialog">
          {children}
          <button
            type="button"
            data-testid="dialog-close"
            onClick={() => onOpenChange?.(false)}
          >
            close
          </button>
        </div>
      ) : null,
    DialogContent: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: { children?: ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
    DialogTrigger: Passthrough,
  };
});

function setLegacyData() {
  window.localStorage.setItem(
    LEGACY_SIMULATION_KEY,
    JSON.stringify({
      name: "Casa Vila Mariana",
      propertyValue: 500_000,
      downPayment: 50_000,
      termMonths: 360,
      annualRate: 11.5,
      startDate: "2024-03-01",
    }),
  );
}

function mockAuthed() {
  useSessionMock.mockReturnValue({
    data: {
      user: {
        id: "user-1",
        email: "joao@exemplo.com",
        name: "João",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {},
    },
    isPending: false,
    error: null,
  });
}

function mockAnonymous() {
  useSessionMock.mockReturnValue({
    data: null,
    isPending: false,
    error: null,
  });
}

function mockLoading() {
  useSessionMock.mockReturnValue({
    data: null,
    isPending: true,
    error: null,
  });
}

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/financiamento"]}>
        <Routes>
          <Route
            path="/financiamento"
            element={<MigrateLocalSimulationDialog />}
          />
          <Route
            path="/historico/:scenarioId"
            element={<div>Historico detalhe page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MigrateLocalSimulationDialog", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    createScenarioMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders nothing while the session is loading", () => {
    mockLoading();
    setLegacyData();
    renderDialog();
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
  });

  it("renders nothing for anonymous users", () => {
    mockAnonymous();
    setLegacyData();
    renderDialog();
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBeNull();
  });

  it("renders nothing when the migration flag is already set", () => {
    mockAuthed();
    setLegacyData();
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
    renderDialog();
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    // legacy data is left untouched — the user already decided
    expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).not.toBeNull();
  });

  it("marks migration done without prompting when no legacy data exists", () => {
    mockAuthed();
    renderDialog();
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
  });

  it("opens the dialog when an authed user has legacy data and the flag is unset", () => {
    mockAuthed();
    setLegacyData();
    renderDialog();
    expect(screen.getByTestId("migration-dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /importar simulação salva/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Casa Vila Mariana/)).toBeInTheDocument();
  });

  it("clears legacy data and sets the migration flag on Descartar", () => {
    mockAuthed();
    setLegacyData();
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    expect(createScenarioMock).not.toHaveBeenCalled();
  });

  it("POSTs the scenario, sets the flag, clears legacy data, and navigates to the detail page on Importar", async () => {
    mockAuthed();
    setLegacyData();
    const created: ScenarioApi = {
      id: "scenario-42",
      user_id: "user-1",
      name: "Casa Vila Mariana",
      property_value_cents: 50_000_000,
      down_payment_cents: 5_000_000,
      term_months: 360,
      annual_rate_basis_points: 1150,
      start_date: "2024-03-01",
      created_at: Date.now(),
      archived_at: null,
    };
    createScenarioMock.mockResolvedValueOnce(created);

    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() => {
      expect(createScenarioMock).toHaveBeenCalledTimes(1);
    });
    expect(createScenarioMock).toHaveBeenCalledWith({
      name: "Casa Vila Mariana",
      propertyValue: 500_000,
      downPayment: 50_000,
      termMonths: 360,
      annualRate: 11.5,
      startDate: "2024-03-01",
    });

    expect(
      await screen.findByText(/historico detalhe page/i),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
  });

  it("surfaces an inline error and keeps legacy data when the API call fails", async () => {
    mockAuthed();
    setLegacyData();
    createScenarioMock.mockRejectedValueOnce(
      new ApiError("bad request", 400, { error: "validation" }),
    );

    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    expect(
      await screen.findByText(/não foi possível importar a simulação/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("migration-dialog")).toBeInTheDocument();
    expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBeNull();
  });

  it("treats an external close (escape/overlay) as Descartar", async () => {
    mockAuthed();
    setLegacyData();
    renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("dialog-close"));
    });
    expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
  });
});
