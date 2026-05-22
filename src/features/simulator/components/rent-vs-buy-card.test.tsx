import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RentVsBuyCard } from "@/features/simulator/components/rent-vs-buy-card";
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

function FinancingSeed({
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

function RentVsBuyFingerprint() {
  const { rentVsBuy } = useSimulation();
  return (
    <div data-testid="rent-vs-buy-state">
      {rentVsBuy === null ? "null" : "set"}
    </div>
  );
}

interface RenderOptions {
  financing?: FinancingFormValues | null;
}

function renderCard({ financing = null }: RenderOptions = {}) {
  return render(
    <SimulationProvider>
      <FinancingSeed financing={financing} />
      <RentVsBuyCard />
      <RentVsBuyFingerprint />
    </SimulationProvider>,
  );
}

async function fillAllValid() {
  const rentInput = screen.getByLabelText("Aluguel mensal");
  fireEvent.change(rentInput, { target: { value: "2500" } });
  fireEvent.blur(rentInput);

  const adjustmentInput = screen.getByLabelText("Reajuste anual do aluguel");
  fireEvent.change(adjustmentInput, { target: { value: "5" } });
  fireEvent.blur(adjustmentInput);

  const investmentInput = screen.getByLabelText(
    "Rendimento anual do investimento",
  );
  fireEvent.change(investmentInput, { target: { value: "10" } });
  fireEvent.blur(investmentInput);

  const appreciationInput = screen.getByLabelText("Valorização anual do imóvel");
  fireEvent.change(appreciationInput, { target: { value: "6" } });
  fireEvent.blur(appreciationInput);

  const horizonInput = screen.getByLabelText("Horizonte");
  fireEvent.change(horizonInput, { target: { value: "360" } });
  fireEvent.blur(horizonInput);
}

describe("RentVsBuyCard", () => {
  it("renders the card heading and labeled fields in pt-BR", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 3, name: /aluguel vs\. compra/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aluguel mensal")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Reajuste anual do aluguel"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Rendimento anual do investimento"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Rendimento mensal equivalente"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Valorização anual do imóvel"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Custos mensais de propriedade"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Horizonte")).toBeInTheDocument();
    expect(screen.getByLabelText("Unidade do horizonte")).toBeInTheDocument();
  });

  it("shows the empty state when the form is incomplete", () => {
    renderCard({ financing: defaultFinancing });
    expect(
      screen.getByTestId("rent-vs-buy-empty-state").textContent,
    ).toMatch(/preencha os dados/i);
  });

  it("derives the monthly equivalent of the annual investment rate", async () => {
    renderCard();
    const investmentInput = screen.getByLabelText(
      "Rendimento anual do investimento",
    );
    fireEvent.change(investmentInput, { target: { value: "12" } });
    fireEvent.blur(investmentInput);
    const monthlyEquivalent = screen.getByLabelText(
      "Rendimento mensal equivalente",
    );
    await waitFor(() => {
      // (1 + 0.12)^(1/12) - 1 ≈ 0.009488... → ~0,9489%
      expect(monthlyEquivalent.textContent ?? "").toMatch(/0,948\d?%/);
    });
  });

  it("publishes valid rent-vs-buy values to the simulation context", async () => {
    renderCard({ financing: defaultFinancing });
    await fillAllValid();
    await waitFor(() => {
      expect(screen.getByTestId("rent-vs-buy-state").textContent).toBe("set");
    });
  });

  it("renders the results panel with badge and key metrics when valid", async () => {
    renderCard({ financing: defaultFinancing });
    await fillAllValid();
    const badge = await screen.findByTestId("best-scenario-badge");
    expect(badge).toBeInTheDocument();
    expect(["buy", "rent", "tie"]).toContain(badge.getAttribute("data-scenario"));
    expect(screen.getByText(/^vencedor:$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/patrimônio final \(comprar\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/patrimônio final \(alugar \+ investir\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/diferença \(r\$\)/i)).toBeInTheDocument();
    expect(screen.getByText(/diferença \(%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/mês de break-even/i)).toBeInTheDocument();
  });

  it("computes the results independently of the financing context state", async () => {
    renderCard({ financing: null });
    await fillAllValid();
    await waitFor(() => {
      expect(screen.getByTestId("rent-vs-buy-state").textContent).toBe("set");
    });
    const badge = await screen.findByTestId("best-scenario-badge");
    expect(badge).toBeInTheDocument();
  });

  it("recomputes the results when an input changes", async () => {
    renderCard({ financing: defaultFinancing });
    await fillAllValid();
    const diferencaLabel = await screen.findByText(/diferença \(r\$\)/i);
    const diferencaCell = diferencaLabel.parentElement!;
    const initialDiff = diferencaCell.textContent ?? "";

    // Bump rent dramatically so the diference shifts towards buying.
    const rentInput = screen.getByLabelText("Aluguel mensal");
    fireEvent.change(rentInput, { target: { value: "10000" } });
    fireEvent.blur(rentInput);

    await waitFor(() => {
      expect(diferencaCell.textContent ?? "").not.toBe(initialDiff);
    });
  });

  it("converts horizon between meses and anos via the unit selector", async () => {
    renderCard({ financing: defaultFinancing });
    const horizonInput = screen.getByLabelText("Horizonte") as HTMLInputElement;
    const unitSelect = screen.getByLabelText(
      "Unidade do horizonte",
    ) as HTMLSelectElement;

    fireEvent.change(horizonInput, { target: { value: "360" } });
    fireEvent.blur(horizonInput);
    expect(horizonInput.value).toBe("360");

    fireEvent.change(unitSelect, { target: { value: "years" } });
    await waitFor(() => {
      expect(horizonInput.value).toBe("30");
    });

    // Switching back to months should restore the month count.
    fireEvent.change(unitSelect, { target: { value: "months" } });
    await waitFor(() => {
      expect(horizonInput.value).toBe("360");
    });
  });

  it("shows pt-BR error when rent is negative and clears the context state", async () => {
    renderCard({ financing: defaultFinancing });
    await fillAllValid();
    await waitFor(() => {
      expect(screen.getByTestId("rent-vs-buy-state").textContent).toBe("set");
    });
    const rentInput = screen.getByLabelText("Aluguel mensal");
    fireEvent.change(rentInput, { target: { value: "-100" } });
    fireEvent.blur(rentInput);
    await waitFor(() => {
      expect(
        screen.getByText(/aluguel mensal não pode ser negativo/i),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("rent-vs-buy-state").textContent).toBe("null");
    });
  });

  it("treats ownership costs as optional (defaults to 0) without blocking validity", async () => {
    renderCard({ financing: defaultFinancing });
    await fillAllValid();
    // Did not touch monthlyOwnershipCosts — should still be valid + published.
    await waitFor(() => {
      expect(screen.getByTestId("rent-vs-buy-state").textContent).toBe("set");
    });
  });
});
