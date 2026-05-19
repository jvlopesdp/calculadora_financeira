import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportCard } from "@/features/simulator/components/export-card";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

const mockExportSimulation = vi.fn<(payload: unknown) => Promise<void>>(
  async () => {},
);

vi.mock("@/lib/export/excel-export", () => ({
  exportSimulation: (payload: unknown) => mockExportSimulation(payload),
}));

const defaultFinancing: FinancingFormValues = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 1,
  termMonths: 360,
  system: "PRICE",
};

function SimulationSeed({
  financing,
}: {
  financing: FinancingFormValues | null;
}) {
  const { setFinancing } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
  }, [financing, setFinancing]);
  return null;
}

function renderCard({ financing = null as FinancingFormValues | null } = {}) {
  return render(
    <SimulationProvider>
      <SimulationSeed financing={financing} />
      <ExportCard />
    </SimulationProvider>,
  );
}

describe("ExportCard", () => {
  beforeEach(() => {
    mockExportSimulation.mockReset();
    mockExportSimulation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title and empty-state message when financing is missing", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 3, name: /exportar/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("export-empty-state").textContent).toMatch(
      /preencha os dados para habilitar a exportação/i,
    );
  });

  it("disables the Exportar Excel button when financing is missing", () => {
    renderCard();
    const button = screen.getByRole("button", {
      name: /exportar excel/i,
    });
    expect(button).toBeDisabled();
  });

  it("enables the button when financing is present", async () => {
    renderCard({ financing: defaultFinancing });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /exportar excel/i }),
      ).not.toBeDisabled();
    });
    expect(screen.queryByTestId("export-empty-state")).toBeNull();
  });

  it("invokes exportSimulation with the current simulation state when clicked", async () => {
    renderCard({ financing: defaultFinancing });
    const button = await waitFor(() => {
      const btn = screen.getByRole("button", { name: /exportar excel/i });
      expect(btn).not.toBeDisabled();
      return btn;
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockExportSimulation).toHaveBeenCalledTimes(1);
    });
    const arg = mockExportSimulation.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      financing: defaultFinancing,
      extraMonthly: null,
      extraStrategy: "term",
      rentVsBuy: null,
    });
  });

  it("shows an error message if exportSimulation rejects", async () => {
    mockExportSimulation.mockRejectedValueOnce(new Error("boom"));
    renderCard({ financing: defaultFinancing });
    const button = await waitFor(() => {
      const btn = screen.getByRole("button", { name: /exportar excel/i });
      expect(btn).not.toBeDisabled();
      return btn;
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(
        /não foi possível gerar o arquivo/i,
      );
    });
  });
});
