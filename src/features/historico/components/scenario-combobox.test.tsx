import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

import { ScenarioCombobox } from "@/features/historico/components/scenario-combobox";
import type { ScenarioApi } from "@/lib/api-client";

const listScenariosMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    listScenarios: (...args: unknown[]) => listScenariosMock(...args),
  };
});

vi.mock("@/components/ui/dropdown-menu", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  const Item = ({
    children,
    onSelect,
    disabled,
    ...rest
  }: {
    children?: ReactNode;
    onSelect?: (event: Event) => void;
    disabled?: boolean;
    "data-testid"?: string;
  }) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onSelect?.(new Event("click"))}
      data-testid={rest["data-testid"]}
    >
      {children}
    </button>
  );
  return {
    DropdownMenu: ({
      children,
      onOpenChange,
    }: {
      children?: ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div>
        <button
          type="button"
          data-testid="open-dropdown"
          onClick={() => onOpenChange?.(true)}
        >
          open
        </button>
        {children}
      </div>
    ),
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuItem: Item,
  };
});

function makeScenario(overrides: Partial<ScenarioApi>): ScenarioApi {
  return {
    id: "sc_1",
    user_id: "u_1",
    name: "Apartamento",
    property_value_cents: 50000000,
    down_payment_cents: 10000000,
    term_months: 360,
    annual_rate_basis_points: 1050,
    start_date: "2025-01-01",
    created_at: Date.now(),
    archived_at: null,
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/historico/:scenarioId"
          element={
            <>
              <ScenarioCombobox />
              <div data-testid="location" />
            </>
          }
        />
        <Route
          path="/historico/:scenarioId/x"
          element={<div>navigated-to-{":scenarioId"}</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ScenarioCombobox", () => {
  beforeEach(() => {
    (listScenariosMock as Mock).mockReset();
  });

  it("renders the trigger without fetching scenarios initially", () => {
    renderAt("/historico/sc_1");

    expect(screen.getByTestId("scenario-combobox-trigger")).toBeInTheDocument();
    expect(listScenariosMock).not.toHaveBeenCalled();
  });

  it("fetches scenarios lazily when opened and lists them", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([
      makeScenario({ id: "sc_1", name: "Casa A" }),
      makeScenario({ id: "sc_2", name: "Casa B" }),
    ]);

    renderAt("/historico/sc_1");

    fireEvent.click(screen.getByTestId("open-dropdown"));

    await waitFor(() => expect(listScenariosMock).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByTestId("scenario-combobox-item-sc_1"),
    ).toHaveTextContent("Casa A");
    expect(
      screen.getByTestId("scenario-combobox-item-sc_2"),
    ).toHaveTextContent("Casa B");
  });

  it("does not refetch on subsequent opens", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([
      makeScenario({ id: "sc_1", name: "Casa A" }),
    ]);

    renderAt("/historico/sc_1");

    fireEvent.click(screen.getByTestId("open-dropdown"));
    await waitFor(() => expect(listScenariosMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId("open-dropdown"));
    fireEvent.click(screen.getByTestId("open-dropdown"));

    expect(listScenariosMock).toHaveBeenCalledTimes(1);
  });

  it("navigates to the selected scenario on click", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([
      makeScenario({ id: "sc_1", name: "Casa A" }),
      makeScenario({ id: "sc_2", name: "Casa B" }),
    ]);

    render(
      <MemoryRouter initialEntries={["/historico/sc_1"]}>
        <Routes>
          <Route
            path="/historico/:scenarioId"
            element={<ScenarioCombobox />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("open-dropdown"));
    const otherItem = await screen.findByTestId(
      "scenario-combobox-item-sc_2",
    );
    fireEvent.click(otherItem);

    await waitFor(() => {
      expect(screen.getByTestId("scenario-combobox-trigger")).toHaveTextContent(
        /Casa B/,
      );
    });
  });

  it("shows the current scenario name as the trigger label", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([
      makeScenario({ id: "sc_1", name: "Apartamento Centro" }),
      makeScenario({ id: "sc_2", name: "Casa Praia" }),
    ]);

    renderAt("/historico/sc_2");

    fireEvent.click(screen.getByTestId("open-dropdown"));
    await waitFor(() => expect(listScenariosMock).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(screen.getByTestId("scenario-combobox-trigger")).toHaveTextContent(
        "Casa Praia",
      );
    });
  });

  it("renders an error item when the fetch fails", async () => {
    (listScenariosMock as Mock).mockRejectedValueOnce(new Error("boom"));

    renderAt("/historico/sc_1");
    fireEvent.click(screen.getByTestId("open-dropdown"));

    expect(
      await screen.findByTestId("scenario-combobox-error"),
    ).toBeInTheDocument();
  });

  it("renders an empty state when the list is empty", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([]);

    renderAt("/historico/sc_1");
    fireEvent.click(screen.getByTestId("open-dropdown"));

    expect(
      await screen.findByTestId("scenario-combobox-empty"),
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder name when the current scenario has no name", async () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([
      makeScenario({ id: "sc_1", name: "" }),
    ]);

    renderAt("/historico/sc_1");

    expect(screen.getByTestId("scenario-combobox-trigger")).toHaveTextContent(
      "Selecionar cenário",
    );

    fireEvent.click(screen.getByTestId("open-dropdown"));
    expect(
      await screen.findByTestId("scenario-combobox-item-sc_1"),
    ).toHaveTextContent("Cenário sem nome");
  });
});
