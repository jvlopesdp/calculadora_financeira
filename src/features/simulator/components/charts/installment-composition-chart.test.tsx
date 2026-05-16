import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InstallmentCompositionChart,
  InstallmentCompositionTooltipContent,
} from "@/features/simulator/components/charts/installment-composition-chart";
import {
  INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE,
  prepareInstallmentCompositionData,
} from "@/features/simulator/components/charts/installment-composition-chart-data";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
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
}

function Seed({ financing }: SeedProps) {
  const { setFinancing } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
  }, [financing, setFinancing]);
  return null;
}

function renderChart(props: SeedProps) {
  return render(
    <SimulationProvider>
      <Seed {...props} />
      <InstallmentCompositionChart />
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

describe("InstallmentCompositionChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders the empty state when financing is missing", () => {
    renderChart({ financing: null });
    expect(
      screen.getByTestId("installment-composition-chart-empty-state").textContent,
    ).toMatch(/preencha os dados de financiamento/i);
    expect(screen.queryByTestId("installment-composition-chart")).toBeNull();
  });

  it("renders the chart with one point per scheduled month", () => {
    renderChart({ financing: defaultFinancing });
    const chart = screen.getByTestId("installment-composition-chart");
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute("data-point-count")).toBe(
      String(defaultFinancing.termMonths),
    );
  });

  it("renders a section title for the chart", () => {
    renderChart({ financing: defaultFinancing });
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: /composição das parcelas/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("prepareInstallmentCompositionData", () => {
  it("returns null when financing is missing", () => {
    expect(prepareInstallmentCompositionData(null)).toBeNull();
  });

  it("returns one point per month with juros + amortizacao === total", () => {
    const data = prepareInstallmentCompositionData(defaultFinancing);
    expect(data).not.toBeNull();
    expect(data?.length).toBe(defaultFinancing.termMonths);
    for (const point of data!) {
      expect(point.juros).toBeGreaterThanOrEqual(0);
      expect(point.amortizacao).toBeGreaterThanOrEqual(0);
      expect(point.total).toBeCloseTo(point.juros + point.amortizacao, 2);
    }
  });

  it("for PRICE: interest decreases monotonically while amortization grows", () => {
    const data = prepareInstallmentCompositionData(defaultFinancing);
    expect(data).not.toBeNull();
    expect(data![0].juros).toBeGreaterThan(data![data!.length - 1].juros);
    expect(data![0].amortizacao).toBeLessThan(
      data![data!.length - 1].amortizacao,
    );
  });

  it("supports the SAC system", () => {
    const data = prepareInstallmentCompositionData({
      ...defaultFinancing,
      system: "SAC",
    });
    expect(data).not.toBeNull();
    expect(data?.length).toBe(defaultFinancing.termMonths);
    expect(data![0].juros).toBeGreaterThan(data![data!.length - 1].juros);
  });

  it("returns null when engine validation fails (invalid inputs)", () => {
    const data = prepareInstallmentCompositionData({
      ...defaultFinancing,
      termMonths: 0,
    });
    expect(data).toBeNull();
  });
});

describe("InstallmentCompositionTooltipContent", () => {
  it("returns null when inactive", () => {
    const { container } = render(
      <InstallmentCompositionTooltipContent
        active={false}
        label={5}
        payload={[
          {
            payload: {
              month: 5,
              juros: 1_200,
              amortizacao: 800,
              total: 2_000,
            },
          },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <InstallmentCompositionTooltipContent active label={5} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pt-BR labels and BRL-formatted values for each series", () => {
    render(
      <InstallmentCompositionTooltipContent
        active
        label={12}
        payload={[
          {
            payload: {
              month: 12,
              juros: 2_400,
              amortizacao: 1_600,
              total: 4_000,
            },
          },
        ]}
      />,
    );
    const tooltip = screen.getByTestId("installment-composition-tooltip");
    expect(tooltip.textContent).toMatch(/Mês 12/);
    expect(tooltip.textContent).toMatch(/1 ano e 0 meses/);
    expect(tooltip.textContent).toMatch(/Juros/);
    expect(tooltip.textContent).toMatch(/Amortização/);
    expect(tooltip.textContent).toMatch(/Parcela total/);
    expect(tooltip.textContent).toMatch(/R\$ 2\.400,00/);
    expect(tooltip.textContent).toMatch(/R\$ 1\.600,00/);
    expect(tooltip.textContent).toMatch(/R\$ 4\.000,00/);
  });
});

describe("INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE", () => {
  it("is the pt-BR copy used by the chart's empty state branch", () => {
    expect(INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE).toMatch(/financiamento/i);
    expect(INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE).toMatch(/parcela/i);
  });
});
