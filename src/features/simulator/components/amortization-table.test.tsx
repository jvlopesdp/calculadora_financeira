import { useEffect } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AmortizationTable } from "@/features/simulator/components/amortization-table";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

const defaultFinancing: FinancingFormValues = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 1,
  termMonths: 360,
  system: "PRICE",
};

function SimulationSeed({
  financing,
  extraMonthly = null,
}: {
  financing: FinancingFormValues | null;
  extraMonthly?: number | null;
}) {
  const { setFinancing, setExtraMonthly } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
    setExtraMonthly(extraMonthly);
  }, [financing, extraMonthly, setFinancing, setExtraMonthly]);
  return null;
}

interface RenderOptions {
  financing?: FinancingFormValues | null;
  extraMonthly?: number | null;
}

function renderTable({
  financing = null,
  extraMonthly = null,
}: RenderOptions = {}) {
  return render(
    <SimulationProvider>
      <SimulationSeed financing={financing} extraMonthly={extraMonthly} />
      <AmortizationTable />
    </SimulationProvider>,
  );
}

function getDataRows(): HTMLTableRowElement[] {
  const tbody = document.querySelector("tbody");
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr[data-month]"));
}

describe("AmortizationTable", () => {
  it("renders the empty state when no financing is provided", () => {
    renderTable();
    expect(
      screen.getByTestId("amortization-table-empty-state").textContent,
    ).toMatch(/preencha os dados para simular/i);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders the section title, scenario selector with three options, and all column headers", async () => {
    renderTable({ financing: defaultFinancing });
    expect(
      screen.getByRole("heading", { level: 3, name: /tabela de amortização/i }),
    ).toBeInTheDocument();

    const scenarioSelect = screen.getByLabelText("Cenário") as HTMLSelectElement;
    const optionLabels = Array.from(scenarioSelect.options).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      "Base",
      "Com extra (reduzir prazo)",
      "Com extra (reduzir parcela)",
    ]);

    const expectedColumns = [
      "Mês",
      "Parcela base",
      "Juros",
      "Amortização",
      "Pagamento extra",
      "Pagamento total",
      "Saldo devedor",
      "Juros acumulados",
      "Amortização acumulada",
      "Status",
    ];
    const headerCells = Array.from(
      document.querySelectorAll("thead th"),
    ).map((th) => th.textContent?.replace(/[▲▼↕]/g, "").trim());
    expect(headerCells).toEqual(expectedColumns);
  });

  it("paginates to 12 rows per page and advances/retreats via the controls", async () => {
    renderTable({ financing: defaultFinancing });

    const initialRows = getDataRows();
    expect(initialRows).toHaveLength(12);
    expect(initialRows[0].dataset.month).toBe("1");
    expect(initialRows[11].dataset.month).toBe("12");

    expect(
      screen.getByTestId("amortization-table-pagination").textContent,
    ).toMatch(/Página 1 de 30/i);

    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].dataset.month).toBe("13");
      expect(rows[11].dataset.month).toBe("24");
    });

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].dataset.month).toBe("1");
    });
  });

  it("filters by month range and resets to page 1", async () => {
    renderTable({ financing: defaultFinancing });

    // Navigate away from page 1 first
    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await waitFor(() => {
      expect(getDataRows()[0].dataset.month).toBe("13");
    });

    fireEvent.change(screen.getByLabelText("Mês inicial"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Mês final"), {
      target: { value: "9" },
    });

    await waitFor(() => {
      const rows = getDataRows();
      expect(rows).toHaveLength(5);
      expect(rows[0].dataset.month).toBe("5");
      expect(rows[4].dataset.month).toBe("9");
    });
    expect(
      screen.getByTestId("amortization-table-pagination").textContent,
    ).toMatch(/Página 1 de 1/i);
  });

  it("sorts by a numeric column when its header button is clicked", async () => {
    renderTable({ financing: defaultFinancing });

    const balanceHeader = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.startsWith("Saldo devedor"));
    expect(balanceHeader).toBeDefined();

    // First click sorts ascending → smallest balance (last month) jumps to top
    fireEvent.click(balanceHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      // For a 360-month financing, the final months have the smallest balance
      expect(Number(rows[0].dataset.month)).toBe(360);
    });

    // Second click sorts descending → largest balance (month 1) returns to top
    fireEvent.click(balanceHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].dataset.month).toBe("1");
    });
  });

  it("hides a column when toggled off via the visibility menu", async () => {
    renderTable({ financing: defaultFinancing });

    const hideJurosCheckbox = screen.getByRole("checkbox", {
      name: /mostrar coluna juros$/i,
    });
    expect(hideJurosCheckbox).toBeChecked();
    fireEvent.click(hideJurosCheckbox);

    await waitFor(() => {
      const headers = Array.from(
        document.querySelectorAll("thead th"),
      ).map((th) => th.textContent?.replace(/[▲▼↕]/g, "").trim());
      expect(headers).not.toContain("Juros");
      expect(headers).toContain("Amortização");
    });
  });

  it("switches scenario to with-extra (reduce term) and changes the rendered schedule", async () => {
    renderTable({ financing: defaultFinancing, extraMonthly: 1500 });

    // Base initially: month-1 row has zero extra payment
    const baseFirstRow = getDataRows()[0];
    expect(within(baseFirstRow).getByText(/R\$\s*0,00/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cenário"), {
      target: { value: "extra-term" },
    });

    await waitFor(() => {
      const row = getDataRows()[0];
      const extraCell = row.querySelector('td[data-column="extraPayment"]');
      expect(extraCell?.textContent).toMatch(/R\$\s*1\.500,00/);
    });
  });

  it("marks the final row of the schedule as 'Última parcela'", async () => {
    renderTable({ financing: defaultFinancing });

    // Jump to the last page (page 30 / 30 → safePage 29 → rows 349..360)
    // Click "Próxima" 29 times via test loop
    const nextBtn = screen.getByRole("button", { name: /próxima/i });
    for (let i = 0; i < 29; i++) {
      fireEvent.click(nextBtn);
    }

    await waitFor(() => {
      const rows = getDataRows();
      const last = rows[rows.length - 1];
      expect(last.dataset.month).toBe("360");
      const statusCell = last.querySelector('td[data-column="status"]');
      expect(statusCell?.textContent).toBe("Última parcela");
    });
  });

  it("applies the .font-tabular class to monetary cells", () => {
    renderTable({ financing: defaultFinancing });
    const firstRow = getDataRows()[0];
    const baseInstallmentCell = firstRow.querySelector(
      'td[data-column="baseInstallment"]',
    );
    const statusCell = firstRow.querySelector('td[data-column="status"]');
    expect(baseInstallmentCell?.className).toMatch(/font-tabular/);
    expect(statusCell?.className).not.toMatch(/font-tabular/);
  });

  it("uses the engine schedule directly (PRICE base installment matches calculatePriceInstallment)", () => {
    renderTable({ financing: defaultFinancing });
    const firstRow = getDataRows()[0];
    // For 400k @ 1%/month × 360 months: PRICE installment is R$ 4.114,45
    const installmentCell = firstRow.querySelector(
      'td[data-column="installment"]',
    );
    expect(installmentCell?.textContent).toMatch(/R\$\s*4\.114,45/);
  });

  it("wraps the table in a responsive horizontal scroll container", () => {
    renderTable({ financing: defaultFinancing });
    const scroll = screen.getByTestId("amortization-table-scroll");
    expect(scroll.className).toMatch(/overflow-x-auto/);
  });
});
