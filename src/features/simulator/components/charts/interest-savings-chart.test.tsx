import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InterestSavingsChart,
  InterestSavingsTooltipContent,
} from "@/features/simulator/components/charts/interest-savings-chart";
import {
  INTEREST_SAVINGS_CHART_EMPTY_STATE,
  prepareInterestSavingsData,
} from "@/features/simulator/components/charts/interest-savings-chart-data";
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
      <InterestSavingsChart />
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

describe("InterestSavingsChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the empty state when financing is missing", () => {
    renderChart({ financing: null, extraMonthly: 500, strategy: "term" });
    expect(
      screen.getByTestId("interest-savings-chart-empty-state").textContent,
    ).toMatch(/informe um valor extra para visualizar a economia/i);
    expect(screen.queryByTestId("interest-savings-chart")).toBeNull();
  });

  it("renders the empty state when extra monthly is null", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: null,
      strategy: "term",
    });
    expect(
      screen.getByTestId("interest-savings-chart-empty-state").textContent,
    ).toMatch(/informe um valor extra para visualizar a economia/i);
    expect(screen.queryByTestId("interest-savings-chart")).toBeNull();
  });

  it("renders the empty state when extra monthly is zero", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: 0,
      strategy: "term",
    });
    expect(
      screen.getByTestId("interest-savings-chart-empty-state").textContent,
    ).toMatch(/informe um valor extra para visualizar a economia/i);
    expect(screen.queryByTestId("interest-savings-chart")).toBeNull();
  });

  it("renders the chart with the expected number of data points when extra payment is positive", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: 500,
      strategy: "term",
    });
    const chart = screen.getByTestId("interest-savings-chart");
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute("data-point-count")).toBe(
      String(defaultFinancing.termMonths + 1),
    );
    expect(chart.getAttribute("data-strategy")).toBe("term");
  });

  it("reflects the active strategy", () => {
    renderChart({
      financing: defaultFinancing,
      extraMonthly: 500,
      strategy: "installment",
    });
    const chart = screen.getByTestId("interest-savings-chart");
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
        name: /economia acumulada de juros/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("prepareInterestSavingsData", () => {
  it("returns null when financing is missing", () => {
    expect(prepareInterestSavingsData(null, 500, "term")).toBeNull();
  });

  it("returns null when extra monthly is null", () => {
    expect(
      prepareInterestSavingsData(defaultFinancing, null, "term"),
    ).toBeNull();
  });

  it("returns null when extra monthly is zero", () => {
    expect(prepareInterestSavingsData(defaultFinancing, 0, "term")).toBeNull();
  });

  it("returns null when extra monthly is negative", () => {
    expect(
      prepareInterestSavingsData(defaultFinancing, -100, "term"),
    ).toBeNull();
  });

  it("returns termMonths + 1 data points starting at month 0 with zero savings", () => {
    const data = prepareInterestSavingsData(defaultFinancing, 500, "term");
    expect(data).not.toBeNull();
    expect(data?.length).toBe(defaultFinancing.termMonths + 1);
    expect(data?.[0].month).toBe(0);
    expect(data?.[0].economiaAcumulada).toBe(0);
  });

  it("cumulative savings are monotonically non-decreasing", () => {
    const data = prepareInterestSavingsData(defaultFinancing, 1_000, "term");
    expect(data).not.toBeNull();
    for (let i = 1; i < data!.length; i++) {
      expect(data![i].economiaAcumulada).toBeGreaterThanOrEqual(
        data![i - 1].economiaAcumulada - 0.01,
      );
    }
  });

  it("ends with a positive cumulative savings when extra payment is positive", () => {
    const data = prepareInterestSavingsData(defaultFinancing, 1_000, "term");
    expect(data).not.toBeNull();
    expect(data![data!.length - 1].economiaAcumulada).toBeGreaterThan(0);
  });

  it("returns null when engine validation fails (invalid inputs)", () => {
    const data = prepareInterestSavingsData(
      { ...defaultFinancing, termMonths: 0 },
      500,
      "term",
    );
    expect(data).toBeNull();
  });

  it("supports the reduce-installment strategy", () => {
    const data = prepareInterestSavingsData(
      defaultFinancing,
      500,
      "installment",
    );
    expect(data).not.toBeNull();
    expect(data![data!.length - 1].economiaAcumulada).toBeGreaterThan(0);
  });
});

describe("InterestSavingsTooltipContent", () => {
  it("returns null when inactive", () => {
    const { container } = render(
      <InterestSavingsTooltipContent
        active={false}
        label={5}
        payload={[
          {
            payload: {
              month: 5,
              economiaAcumulada: 1_000,
            },
          },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <InterestSavingsTooltipContent active label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pt-BR labels and BRL-formatted values", () => {
    render(
      <InterestSavingsTooltipContent
        active
        label={24}
        payload={[
          {
            payload: {
              month: 24,
              economiaAcumulada: 12_345.67,
            },
          },
        ]}
      />,
    );
    const tooltip = screen.getByTestId("interest-savings-tooltip");
    expect(tooltip.textContent).toMatch(/Mês 24/);
    expect(tooltip.textContent).toMatch(/2 anos e 0 meses/);
    expect(tooltip.textContent).toMatch(/Economia acumulada/);
    expect(tooltip.textContent).toMatch(/R\$ 12\.345,67/);
  });
});

describe("INTEREST_SAVINGS_CHART_EMPTY_STATE", () => {
  it("is the pt-BR copy used by the chart's empty state branch", () => {
    expect(INTEREST_SAVINGS_CHART_EMPTY_STATE).toMatch(/informe um valor extra/i);
    expect(INTEREST_SAVINGS_CHART_EMPTY_STATE).toMatch(/economia/i);
  });
});
