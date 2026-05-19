import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NetWorthChart,
  NetWorthTooltipContent,
} from "@/features/simulator/components/charts/net-worth-chart";
import {
  NET_WORTH_CHART_EMPTY_STATE,
  prepareNetWorthData,
} from "@/features/simulator/components/charts/net-worth-chart-data";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

const defaultFinancing: FinancingFormValues = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 0.8,
  termMonths: 360,
  system: "PRICE",
};

const defaultRentVsBuy: RentVsBuyFormValues = {
  monthlyRent: 2_500,
  annualRentAdjustment: 5,
  annualInvestmentReturn: 8,
  annualAppreciation: 5,
  monthlyOwnershipCosts: 250,
  horizonMonths: 120,
};

interface SeedProps {
  financing: FinancingFormValues | null;
  rentVsBuy: RentVsBuyFormValues | null;
}

function Seed({ financing, rentVsBuy }: SeedProps) {
  const { setFinancing, setRentVsBuy } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
    setRentVsBuy(rentVsBuy);
  }, [financing, rentVsBuy, setFinancing, setRentVsBuy]);
  return null;
}

function renderChart(props: SeedProps) {
  return render(
    <SimulationProvider>
      <Seed {...props} />
      <NetWorthChart />
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

describe("NetWorthChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the empty state when both financing and rent-vs-buy are missing", () => {
    renderChart({ financing: null, rentVsBuy: null });
    expect(
      screen.getByTestId("net-worth-chart-empty-state").textContent,
    ).toMatch(/preencha os dados de financiamento e aluguel vs\. compra/i);
    expect(screen.queryByTestId("net-worth-chart")).toBeNull();
  });

  it("renders the empty state when only financing is set", () => {
    renderChart({ financing: defaultFinancing, rentVsBuy: null });
    expect(
      screen.getByTestId("net-worth-chart-empty-state"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when only rentVsBuy is set", () => {
    renderChart({ financing: null, rentVsBuy: defaultRentVsBuy });
    expect(
      screen.getByTestId("net-worth-chart-empty-state"),
    ).toBeInTheDocument();
  });

  it("renders the chart container with the expected number of data points", () => {
    renderChart({
      financing: defaultFinancing,
      rentVsBuy: defaultRentVsBuy,
    });
    const chart = screen.getByTestId("net-worth-chart");
    expect(chart).toBeInTheDocument();
    // horizonMonths=120 → 121 entries (m=0..120)
    expect(chart.getAttribute("data-point-count")).toBe("121");
  });

  it("renders a section title for the chart", () => {
    renderChart({
      financing: defaultFinancing,
      rentVsBuy: defaultRentVsBuy,
    });
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: /patrimônio ao longo do tempo/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("prepareNetWorthData", () => {
  it("returns null when financing is missing", () => {
    expect(prepareNetWorthData(null, defaultRentVsBuy)).toBeNull();
  });

  it("returns null when rentVsBuy is missing", () => {
    expect(prepareNetWorthData(defaultFinancing, null)).toBeNull();
  });

  it("returns horizonMonths + 1 data points starting at month 0", () => {
    const data = prepareNetWorthData(defaultFinancing, defaultRentVsBuy);
    expect(data).not.toBeNull();
    expect(data?.length).toBe(defaultRentVsBuy.horizonMonths + 1);
    expect(data?.[0].month).toBe(0);
    expect(data?.[data.length - 1].month).toBe(defaultRentVsBuy.horizonMonths);
  });

  it("each point carries comprar/alugar/diferenca with diferenca = comprar - alugar", () => {
    const data = prepareNetWorthData(defaultFinancing, defaultRentVsBuy);
    expect(data).not.toBeNull();
    for (const point of data!) {
      expect(typeof point.comprar).toBe("number");
      expect(typeof point.alugar).toBe("number");
      expect(typeof point.diferenca).toBe("number");
      expect(point.diferenca).toBeCloseTo(point.comprar - point.alugar, 2);
    }
  });

  it("returns null when engine validation fails (invalid inputs)", () => {
    const data = prepareNetWorthData(
      { ...defaultFinancing, propertyValue: 0 },
      defaultRentVsBuy,
    );
    expect(data).toBeNull();
  });
});

describe("NetWorthTooltipContent", () => {
  it("returns null when inactive", () => {
    const { container } = render(
      <NetWorthTooltipContent
        active={false}
        label={5}
        payload={[
          {
            payload: {
              month: 5,
              comprar: 1_000,
              alugar: 2_000,
              diferenca: -1_000,
            },
          },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <NetWorthTooltipContent active label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pt-BR labels and BRL-formatted values for each series", () => {
    render(
      <NetWorthTooltipContent
        active
        label={24}
        payload={[
          {
            payload: {
              month: 24,
              comprar: 123_456.78,
              alugar: 100_000,
              diferenca: 23_456.78,
            },
          },
        ]}
      />,
    );
    const tooltip = screen.getByTestId("net-worth-tooltip");
    expect(tooltip.textContent).toMatch(/Mês 24/);
    expect(tooltip.textContent).toMatch(/2 anos e 0 meses/);
    expect(tooltip.textContent).toMatch(/Comprar/);
    expect(tooltip.textContent).toMatch(/Alugar e investir/);
    expect(tooltip.textContent).toMatch(/Diferença/);
    expect(tooltip.textContent).toMatch(/R\$ 123\.456,78/);
    expect(tooltip.textContent).toMatch(/R\$ 100\.000,00/);
    expect(tooltip.textContent).toMatch(/R\$ 23\.456,78/);
  });

  it("displays a negative difference with the BRL minus sign", () => {
    render(
      <NetWorthTooltipContent
        active
        label={12}
        payload={[
          {
            payload: {
              month: 12,
              comprar: 50_000,
              alugar: 75_000,
              diferenca: -25_000,
            },
          },
        ]}
      />,
    );
    expect(screen.getByTestId("net-worth-tooltip").textContent).toMatch(
      /-R\$ 25\.000,00/,
    );
  });
});

describe("NET_WORTH_CHART_EMPTY_STATE", () => {
  it("is the pt-BR copy used by the chart's empty state branch", () => {
    expect(NET_WORTH_CHART_EMPTY_STATE).toMatch(/financiamento/i);
    expect(NET_WORTH_CHART_EMPTY_STATE).toMatch(/aluguel vs\. compra/i);
  });
});
