import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OutstandingBalanceChart,
  OutstandingBalanceTooltipContent,
} from "@/features/simulator/components/charts/outstanding-balance-chart";
import {
  OUTSTANDING_BALANCE_CHART_EMPTY_STATE,
  prepareOutstandingBalanceData,
} from "@/features/simulator/components/charts/outstanding-balance-chart-data";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import {
  useSimulation,
  type ExtraPaymentStrategy,
} from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

const defaultFinancing: FinancingFormValues = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 0.8,
  termMonths: 360,
  system: "PRICE",
};

interface SeedProps {
  financing: FinancingFormValues | null;
  extraMonthly: number | null;
  strategy: ExtraPaymentStrategy;
}

function Seed({ financing, extraMonthly, strategy }: SeedProps) {
  const { setFinancing, setExtraMonthly, setExtraStrategy } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
    setExtraMonthly(extraMonthly);
    setExtraStrategy(strategy);
  }, [
    financing,
    extraMonthly,
    strategy,
    setFinancing,
    setExtraMonthly,
    setExtraStrategy,
  ]);
  return null;
}

function renderChart(props: SeedProps) {
  return render(
    <SimulationProvider>
      <Seed {...props} />
      <OutstandingBalanceChart />
    </SimulationProvider>,
  );
}

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

describe("OutstandingBalanceChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the empty state when financing is missing", () => {
    renderChart({ financing: null, extraMonthly: null, strategy: "term" });
    expect(
      screen.getByTestId("outstanding-balance-chart-empty-state").textContent,
    ).toMatch(/preencha os dados de financiamento/i);
    expect(screen.queryByTestId("outstanding-balance-chart")).toBeNull();
  });

  it("renders the chart with the expected number of data points when financing is set without extra", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: null,
      strategy: "term",
    });
    const chart = screen.getByTestId("outstanding-balance-chart");
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute("data-point-count")).toBe(
      String(defaultFinancing.termMonths + 1),
    );
    expect(chart.getAttribute("data-strategy")).toBe("term");
  });

  it("renders the chart and reflects the active strategy", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: 500,
      strategy: "installment",
    });
    const chart = screen.getByTestId("outstanding-balance-chart");
    expect(chart.getAttribute("data-strategy")).toBe("installment");
  });

  it("renders a section title for the chart", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: 500,
      strategy: "term",
    });
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: /saldo devedor ao longo do tempo/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("prepareOutstandingBalanceData", () => {
  it("returns null when financing is missing", () => {
    expect(prepareOutstandingBalanceData(null, 500, "term")).toBeNull();
  });

  it("returns termMonths + 1 data points starting at month 0 when no extra payment", () => {
    const data = prepareOutstandingBalanceData(defaultFinancing, null, "term");
    expect(data).not.toBeNull();
    expect(data?.length).toBe(defaultFinancing.termMonths + 1);
    expect(data?.[0].month).toBe(0);
    expect(data?.[0].saldoBase).toBeCloseTo(
      defaultFinancing.propertyValue - defaultFinancing.downPayment,
      2,
    );
    expect(data?.[0].saldoExtra).toBeCloseTo(
      defaultFinancing.propertyValue - defaultFinancing.downPayment,
      2,
    );
    expect(data?.[data.length - 1].saldoBase).toBeLessThan(0.01);
  });

  it("with a positive extra payment, the extra balance ends at or before the base balance length", () => {
    const data = prepareOutstandingBalanceData(
      defaultFinancing,
      1_000,
      "term",
    );
    expect(data).not.toBeNull();
    expect(data!.length).toBe(defaultFinancing.termMonths + 1);
    let firstExtraZero: number | null = null;
    for (const point of data!) {
      if (firstExtraZero === null && point.saldoExtra <= 0.01) {
        firstExtraZero = point.month;
      }
    }
    expect(firstExtraZero).not.toBeNull();
    expect(firstExtraZero!).toBeLessThan(defaultFinancing.termMonths);
    expect(data![defaultFinancing.termMonths].saldoBase).toBeLessThan(0.01);
  });

  it("diferenca on each point equals saldoBase - saldoExtra", () => {
    const data = prepareOutstandingBalanceData(
      defaultFinancing,
      500,
      "installment",
    );
    expect(data).not.toBeNull();
    for (const point of data!) {
      expect(point.diferenca).toBeCloseTo(
        point.saldoBase - point.saldoExtra,
        2,
      );
    }
  });

  it("with zero extra, base and with-extra series overlap exactly", () => {
    const data = prepareOutstandingBalanceData(defaultFinancing, 0, "term");
    expect(data).not.toBeNull();
    for (const point of data!) {
      expect(point.saldoExtra).toBeCloseTo(point.saldoBase, 2);
    }
  });

  it("returns null when engine validation fails (invalid inputs)", () => {
    const data = prepareOutstandingBalanceData(
      { ...defaultFinancing, termMonths: 0 },
      500,
      "term",
    );
    expect(data).toBeNull();
  });
});

describe("OutstandingBalanceTooltipContent", () => {
  it("returns null when inactive", () => {
    const { container } = render(
      <OutstandingBalanceTooltipContent
        active={false}
        label={5}
        payload={[
          {
            payload: {
              month: 5,
              saldoBase: 1_000,
              saldoExtra: 900,
              diferenca: 100,
            },
          },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <OutstandingBalanceTooltipContent active label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pt-BR labels and BRL-formatted values for each series", () => {
    render(
      <OutstandingBalanceTooltipContent
        active
        label={24}
        payload={[
          {
            payload: {
              month: 24,
              saldoBase: 380_000,
              saldoExtra: 350_000,
              diferenca: 30_000,
            },
          },
        ]}
      />,
    );
    const tooltip = screen.getByTestId("outstanding-balance-tooltip");
    expect(tooltip.textContent).toMatch(/Mês 24/);
    expect(tooltip.textContent).toMatch(/2 anos e 0 meses/);
    expect(tooltip.textContent).toMatch(/Saldo base/);
    expect(tooltip.textContent).toMatch(/Saldo com extra/);
    expect(tooltip.textContent).toMatch(/Diferença/);
    expect(tooltip.textContent).toMatch(/R\$ 380\.000,00/);
    expect(tooltip.textContent).toMatch(/R\$ 350\.000,00/);
    expect(tooltip.textContent).toMatch(/R\$ 30\.000,00/);
  });
});

describe("OUTSTANDING_BALANCE_CHART_EMPTY_STATE", () => {
  it("is the pt-BR copy used by the chart's empty state branch", () => {
    expect(OUTSTANDING_BALANCE_CHART_EMPTY_STATE).toMatch(/financiamento/i);
    expect(OUTSTANDING_BALANCE_CHART_EMPTY_STATE).toMatch(/saldo devedor/i);
  });
});
