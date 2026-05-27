import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportButton } from "@/features/simulator/components/export-button";
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

function renderButton({
  financing = null as FinancingFormValues | null,
} = {}) {
  return render(
    <SimulationProvider>
      <SimulationSeed financing={financing} />
      <ExportButton />
    </SimulationProvider>,
  );
}

describe("ExportButton", () => {
  beforeEach(() => {
    mockExportSimulation.mockReset();
    mockExportSimulation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Exportar Excel button disabled with an empty-state hint when no financing", () => {
    renderButton();
    const button = screen.getByRole("button", { name: /exportar excel/i });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(
      /preencha os dados para habilitar a exportação/i,
    );
    expect(screen.getByTestId("export-empty-state").textContent).toMatch(
      /preencha os dados para habilitar a exportação/i,
    );
  });

  it("enables the button when financing is present", async () => {
    renderButton({ financing: defaultFinancing });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /exportar excel/i }),
      ).not.toBeDisabled();
    });
    expect(screen.queryByTestId("export-empty-state")).toBeNull();
  });

  it("invokes exportSimulation with the current simulation state when clicked", async () => {
    renderButton({ financing: defaultFinancing });
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
    renderButton({ financing: defaultFinancing });
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
