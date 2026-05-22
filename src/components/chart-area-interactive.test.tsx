import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChartAreaInteractive,
  ChartAreaTooltipContent,
  type ChartView,
} from "@/components/chart-area-interactive";

class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const entry = {
      target,
      contentRect: {
        width: 600,
        height: 300,
        top: 0,
        right: 600,
        bottom: 300,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      },
      borderBoxSize: [{ inlineSize: 600, blockSize: 300 }],
      contentBoxSize: [{ inlineSize: 600, blockSize: 300 }],
      devicePixelContentBoxSize: [{ inlineSize: 600, blockSize: 300 }],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

function pointSeries(months: number): { month: number; saldoBase: number; saldoExtra: number }[] {
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    saldoBase: 1_000 - i,
    saldoExtra: 900 - i,
  }));
}

const balanceView: ChartView = {
  id: "balance",
  label: "Saldo devedor",
  description: "Comparação entre o saldo base e o saldo com pagamento extra.",
  kind: "line",
  data: pointSeries(120),
  series: [
    { key: "saldoBase", name: "Saldo base", color: "var(--chart-1)" },
    { key: "saldoExtra", name: "Saldo com extra", color: "var(--chart-3)" },
  ],
};

const savingsView: ChartView = {
  id: "savings",
  label: "Juros acumulados",
  kind: "line",
  data: Array.from({ length: 25 }, (_, i) => ({
    month: i,
    economiaAcumulada: i * 10,
  })),
  series: [
    {
      key: "economiaAcumulada",
      name: "Economia acumulada",
      color: "var(--chart-5)",
    },
  ],
};

const compositionView: ChartView = {
  id: "composition",
  label: "Composição",
  kind: "area",
  data: Array.from({ length: 36 }, (_, i) => ({
    month: i + 1,
    juros: 500 - i,
    amortizacao: 100 + i,
  })),
  series: [
    {
      key: "juros",
      name: "Juros",
      color: "var(--chart-2)",
      stackId: "installment",
    },
    {
      key: "amortizacao",
      name: "Amortização",
      color: "var(--chart-4)",
      stackId: "installment",
    },
  ],
};

const emptyView: ChartView = {
  id: "empty",
  label: "Vazio",
  kind: "line",
  data: [],
  series: [{ key: "x", name: "X", color: "var(--chart-1)" }],
  emptyState: "Sem dados aqui",
};

describe("ChartAreaInteractive", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the title and the active view description", () => {
    render(
      <ChartAreaInteractive
        title="Gráficos"
        views={[balanceView, savingsView, compositionView]}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: /^gráficos$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/saldo base e o saldo com pagamento extra/i),
    ).toBeInTheDocument();
  });

  it("renders the range toggle with three options", () => {
    render(
      <ChartAreaInteractive title="X" views={[balanceView]} />,
    );
    const group = screen.getByTestId("chart-area-range-toggle");
    expect(group.querySelectorAll("button")).toHaveLength(3);
    expect(
      group.querySelector('button[data-state="active"]')?.textContent,
    ).toMatch(/total/i);
  });

  it("filters data to 12 months when the 1y range is selected", () => {
    render(
      <ChartAreaInteractive title="X" views={[balanceView]} defaultRange="all" />,
    );
    const canvas = screen.getByTestId("chart-area-canvas");
    expect(canvas.getAttribute("data-point-count")).toBe("121");
    fireEvent.click(screen.getByRole("button", { name: /1 ano/i }));
    expect(canvas.getAttribute("data-range")).toBe("1y");
    expect(canvas.getAttribute("data-point-count")).toBe("13");
  });

  it("filters data to 60 months when the 5y range is selected", () => {
    render(
      <ChartAreaInteractive title="X" views={[balanceView]} defaultRange="all" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /5 anos/i }));
    expect(
      screen.getByTestId("chart-area-canvas").getAttribute("data-point-count"),
    ).toBe("61");
  });

  it("does NOT render the tabs when only one view is provided", () => {
    render(
      <ChartAreaInteractive title="X" views={[balanceView]} />,
    );
    expect(screen.queryByTestId("chart-area-view-tabs")).toBeNull();
  });

  it("renders one tab per view and switches data on click", () => {
    render(
      <ChartAreaInteractive
        title="Gráficos"
        views={[balanceView, savingsView, compositionView]}
        defaultView="balance"
      />,
    );
    const tabs = screen.getByTestId("chart-area-view-tabs");
    expect(tabs.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(
      screen.getByTestId("chart-area-canvas").getAttribute("data-view"),
    ).toBe("balance");

    fireEvent.click(screen.getByRole("tab", { name: /juros acumulados/i }));
    expect(
      screen.getByTestId("chart-area-canvas").getAttribute("data-view"),
    ).toBe("savings");

    fireEvent.click(screen.getByRole("tab", { name: /composição/i }));
    expect(
      screen.getByTestId("chart-area-canvas").getAttribute("data-view"),
    ).toBe("composition");
  });

  it("renders the per-view empty state when data is empty", () => {
    render(<ChartAreaInteractive title="X" views={[emptyView]} />);
    expect(screen.getByTestId("chart-area-empty-state").textContent).toBe(
      "Sem dados aqui",
    );
    expect(screen.queryByTestId("chart-area-canvas")).toBeNull();
  });
});

describe("ChartAreaTooltipContent", () => {
  it("returns null when inactive", () => {
    const { container } = render(
      <ChartAreaTooltipContent active={false} label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <ChartAreaTooltipContent active label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pt-BR month label and BRL-formatted values per series", () => {
    render(
      <ChartAreaTooltipContent
        active
        label={24}
        payload={[
          {
            dataKey: "saldoBase",
            name: "Saldo base",
            color: "var(--chart-1)",
            value: 380_000,
            payload: { month: 24 },
          },
          {
            dataKey: "saldoExtra",
            name: "Saldo com extra",
            color: "var(--chart-3)",
            value: 350_000,
            payload: { month: 24 },
          },
        ]}
      />,
    );
    const tooltip = screen.getByTestId("chart-area-tooltip");
    expect(tooltip.textContent).toMatch(/Mês 24/);
    expect(tooltip.textContent).toMatch(/2 anos e 0 meses/);
    expect(tooltip.textContent).toMatch(/Saldo base/);
    expect(tooltip.textContent).toMatch(/Saldo com extra/);
    expect(tooltip.textContent).toMatch(/R\$ 380\.000,00/);
    expect(tooltip.textContent).toMatch(/R\$ 350\.000,00/);
  });
});
