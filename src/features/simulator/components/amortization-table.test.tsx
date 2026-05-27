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
  return Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-index]"));
}

function getHeaderLabels(): string[] {
  return Array.from(document.querySelectorAll("thead th"))
    .map((th) => th.textContent?.replace(/[▲▼↕]/g, "").trim() ?? "");
}

describe("AmortizationTable", () => {
  it("renders the empty state when no financing is provided", () => {
    renderTable();
    expect(
      screen.getByTestId("amortization-table-empty-state").textContent,
    ).toMatch(/preencha os dados para simular/i);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders the section title, scenario selector with three options, and the documented column set", () => {
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

    expect(getHeaderLabels()).toEqual([
      "Nº",
      "Mês",
      "Parcela",
      "Juros",
      "Amortização",
      "Saldo devedor",
    ]);
  });

  it("shows the 'Extra' column only when the scenario applies extra payments", async () => {
    renderTable({ financing: defaultFinancing, extraMonthly: 1500 });

    // Base scenario hides the Extra column
    expect(getHeaderLabels()).not.toContain("Extra");

    fireEvent.change(screen.getByLabelText("Cenário"), {
      target: { value: "extra-term" },
    });

    await waitFor(() => {
      expect(getHeaderLabels()).toContain("Extra");
    });

    const firstRow = getDataRows()[0];
    const extraCell = firstRow.querySelector('td[data-column="extra"]');
    expect(extraCell?.textContent).toMatch(/R\$\s*1\.500,00/);
  });

  it("paginates to 12 rows per page and advances/retreats via the controls", async () => {
    renderTable({ financing: defaultFinancing });

    const initialRows = getDataRows();
    expect(initialRows).toHaveLength(12);
    expect(initialRows[0].querySelector('td[data-column="month"]')?.textContent).toBe("1");
    expect(initialRows[11].querySelector('td[data-column="month"]')?.textContent).toBe("12");

    expect(
      screen.getByTestId("data-table-pagination").textContent,
    ).toMatch(/Página 1 de 30/i);

    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="month"]')?.textContent).toBe("13");
      expect(rows[11].querySelector('td[data-column="month"]')?.textContent).toBe("24");
    });

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="month"]')?.textContent).toBe("1");
    });
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
      expect(rows[0].querySelector('td[data-column="month"]')?.textContent).toBe("360");
    });

    // Second click sorts descending → largest balance (month 1) returns to top
    fireEvent.click(balanceHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="month"]')?.textContent).toBe("1");
    });
  });

  it("applies the .font-tabular class to monetary cells and right-aligns numeric columns", () => {
    renderTable({ financing: defaultFinancing });
    const firstRow = getDataRows()[0];
    const installmentCell = firstRow.querySelector('td[data-column="installment"]');
    expect(installmentCell?.className).toMatch(/font-tabular/);
    expect(installmentCell?.className).toMatch(/text-right/);
  });

  it("uses the engine schedule directly (PRICE base installment matches calculatePriceInstallment)", () => {
    renderTable({ financing: defaultFinancing });
    const firstRow = getDataRows()[0];
    // For 400k @ 1%/month × 360 months: PRICE installment is R$ 4.114,45
    const installmentCell = firstRow.querySelector('td[data-column="installment"]');
    expect(installmentCell?.textContent).toMatch(/R\$\s*4\.114,45/);
  });

  it("renders sequential Nº numbers starting at 1 on page one", () => {
    renderTable({ financing: defaultFinancing });
    const rows = getDataRows();
    const seq = rows.map((row) => row.querySelector('td[data-column="index"]')?.textContent);
    expect(seq).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  });

  it("switches scenario to with-extra (reduce term) and reflects in the rendered schedule", async () => {
    renderTable({ financing: defaultFinancing, extraMonthly: 1500 });

    fireEvent.change(screen.getByLabelText("Cenário"), {
      target: { value: "extra-term" },
    });

    await waitFor(() => {
      const row = getDataRows()[0];
      const extraCell = row.querySelector('td[data-column="extra"]');
      expect(extraCell?.textContent).toMatch(/R\$\s*1\.500,00/);
    });

    const firstRow = getDataRows()[0];
    expect(within(firstRow).getByText(/R\$\s*1\.500,00/)).toBeInTheDocument();
  });

  it("wraps the table in a responsive horizontal scroll container", () => {
    renderTable({ financing: defaultFinancing });
    const scroll = screen.getByTestId("data-table-scroll");
    expect(scroll.className).toMatch(/overflow-x-auto/);
  });
});
