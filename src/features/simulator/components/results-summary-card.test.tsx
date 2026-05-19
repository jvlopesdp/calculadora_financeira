import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultsSummaryCard } from "@/features/simulator/components/results-summary-card";
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
  extraMonthly?: number | null;
  extraStrategy?: ExtraPaymentStrategy;
}

function Seed({
  financing,
  extraMonthly = null,
  extraStrategy = "term",
}: SeedProps) {
  const { setFinancing, setExtraMonthly, setExtraStrategy } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
    setExtraMonthly(extraMonthly);
    setExtraStrategy(extraStrategy);
  }, [
    financing,
    extraMonthly,
    extraStrategy,
    setFinancing,
    setExtraMonthly,
    setExtraStrategy,
  ]);
  return null;
}

function renderCard(props: SeedProps) {
  return render(
    <SimulationProvider>
      <Seed {...props} />
      <ResultsSummaryCard />
    </SimulationProvider>,
  );
}

describe("ResultsSummaryCard", () => {
  it("renders the empty state when financing is missing", () => {
    renderCard({ financing: null });
    expect(
      screen.getByTestId("results-summary-empty-state").textContent,
    ).toMatch(/preencha os dados para simular/i);
    expect(screen.queryByTestId("summary-financed-amount")).toBeNull();
  });

  it("renders all nine summary metrics when financing is set", () => {
    renderCard({ financing: defaultFinancing });
    expect(screen.getByTestId("summary-financed-amount")).toBeInTheDocument();
    expect(
      screen.getByTestId("summary-initial-installment"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("summary-base-total-paid")).toBeInTheDocument();
    expect(screen.getByTestId("summary-extra-total-paid")).toBeInTheDocument();
    expect(
      screen.getByTestId("summary-base-total-interest"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("summary-extra-total-interest"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("summary-interest-saved")).toBeInTheDocument();
    expect(screen.getByTestId("summary-original-term")).toBeInTheDocument();
    expect(screen.getByTestId("summary-new-term")).toBeInTheDocument();
    expect(screen.getByTestId("summary-months-reduced")).toBeInTheDocument();
  });

  it("formats financed amount as the PRICE principal in BRL", () => {
    renderCard({ financing: defaultFinancing });
    expect(
      screen.getByTestId("summary-financed-amount").textContent,
    ).toMatch(/R\$ 400\.000,00/);
  });

  it("displays the initial PRICE installment", () => {
    renderCard({ financing: defaultFinancing });
    // PRICE 400k @ 0,8% × 360 → first installment ≈ R$ 3.392,64
    expect(
      screen.getByTestId("summary-initial-installment").textContent,
    ).toMatch(/R\$ 3\.392,64/);
  });

  it("renders 'Prazo original' using formatMonths", () => {
    renderCard({ financing: defaultFinancing });
    expect(screen.getByTestId("summary-original-term").textContent).toMatch(
      /30 anos e 0 meses/,
    );
  });

  it("when no extra payment is set, with-extra metrics equal base and economia is zero", () => {
    renderCard({ financing: defaultFinancing, extraMonthly: null });
    const valueOf = (id: string) =>
      screen.getByTestId(id).querySelector("dd")?.textContent ?? "";
    expect(valueOf("summary-extra-total-paid")).toBe(
      valueOf("summary-base-total-paid"),
    );
    expect(valueOf("summary-extra-total-interest")).toBe(
      valueOf("summary-base-total-interest"),
    );
    expect(valueOf("summary-interest-saved")).toMatch(/R\$ 0,00/);
    expect(
      screen
        .getByTestId("summary-interest-saved")
        .getAttribute("data-delta-sign"),
    ).toBe("zero");
    expect(valueOf("summary-months-reduced")).toMatch(/0 meses/);
    expect(valueOf("summary-new-term")).toBe(valueOf("summary-original-term"));
  });

  it("when extra > 0 with reduce-term, shows positive economia and reduced months", () => {
    renderCard({
      financing: defaultFinancing,
      extraMonthly: 500,
      extraStrategy: "term",
    });
    const economia = screen.getByTestId("summary-interest-saved");
    expect(economia.getAttribute("data-delta-sign")).toBe("positive");
    const dd = economia.querySelector("dd");
    expect(dd?.className).toMatch(/text-emerald/);
    const monthsReduced =
      screen.getByTestId("summary-months-reduced").querySelector("dd")
        ?.textContent ?? "";
    expect(monthsReduced).not.toMatch(/^0 meses/);
  });

  it("switching strategy from term to installment updates the with-extra totals reactively", () => {
    const { rerender } = render(
      <SimulationProvider>
        <Seed
          financing={defaultFinancing}
          extraMonthly={500}
          extraStrategy="term"
        />
        <ResultsSummaryCard />
      </SimulationProvider>,
    );
    const termTotal = screen.getByTestId("summary-extra-total-paid")
      .textContent;
    const termMonthsReduced = screen.getByTestId("summary-months-reduced")
      .textContent;

    rerender(
      <SimulationProvider>
        <Seed
          financing={defaultFinancing}
          extraMonthly={500}
          extraStrategy="installment"
        />
        <ResultsSummaryCard />
      </SimulationProvider>,
    );
    const installmentTotal = screen.getByTestId("summary-extra-total-paid")
      .textContent;
    const installmentMonthsReduced = screen.getByTestId(
      "summary-months-reduced",
    ).textContent;
    expect(installmentTotal).not.toBe(termTotal);
    expect(installmentMonthsReduced).not.toBe(termMonthsReduced);
  });

  it("supports SAC system in summary metrics", () => {
    renderCard({
      financing: { ...defaultFinancing, system: "SAC" },
      extraMonthly: 500,
      extraStrategy: "term",
    });
    // SAC initial installment for 400k @ 0,8% × 360 = amort 1.111,11 + juros 3.200 = 4.311,11
    expect(
      screen.getByTestId("summary-initial-installment").textContent,
    ).toMatch(/R\$ 4\.311,11/);
    expect(screen.getByTestId("summary-interest-saved").textContent).toMatch(
      /R\$/,
    );
  });

  it("applies the .font-tabular utility to monetary cells", () => {
    renderCard({ financing: defaultFinancing });
    const financed = screen.getByTestId("summary-financed-amount");
    const valueNode = financed.querySelector("dd");
    expect(valueNode?.className).toMatch(/font-tabular/);
  });
});
