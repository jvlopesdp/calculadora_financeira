import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExtraPaymentCard } from "@/features/simulator/components/extra-payment-card";
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

function FinancingSeed({ financing }: { financing: FinancingFormValues | null }) {
  const { setFinancing } = useSimulation();
  useEffect(() => {
    setFinancing(financing);
  }, [financing, setFinancing]);
  return null;
}

function ExtraFingerprint() {
  const { extraMonthly } = useSimulation();
  return (
    <div data-testid="extra-state">
      {extraMonthly === null ? "null" : String(extraMonthly)}
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
      <ExtraPaymentCard />
      <ExtraFingerprint />
    </SimulationProvider>,
  );
}

describe("ExtraPaymentCard", () => {
  it("renders the pt-BR label and section title", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 3, name: /pagamento extra/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Pagamento extra mensal"),
    ).toBeInTheDocument();
  });

  it("shows the empty-state message when no extra value is entered", () => {
    renderCard({ financing: defaultFinancing });
    expect(
      screen.getByTestId("extra-payment-empty-state").textContent,
    ).toMatch(/informe um valor extra para simular/i);
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
  });

  it("shows the empty-state message when extra is exactly zero", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(
        screen.getByTestId("extra-payment-empty-state").textContent,
      ).toMatch(/informe um valor extra para simular/i);
    });
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
  });

  it("publishes the extra value to the simulation context", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByTestId("extra-state").textContent).toBe("500");
    });
  });

  it("renders both tabs and reactively recomputes when financing + extra are set", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);

    const termTab = await screen.findByRole("tab", { name: /reduzir prazo/i });
    const installmentTab = screen.getByRole("tab", {
      name: /reduzir parcela/i,
    });
    expect(termTab).toBeInTheDocument();
    expect(installmentTab).toBeInTheDocument();

    // Default tab is "reduce term"
    expect(termTab.getAttribute("aria-selected")).toBe("true");
    const termPanel = screen.getByRole("tabpanel", { name: /reduzir prazo/i });

    expect(termPanel.textContent).toMatch(/economia em juros/i);
    expect(termPanel.textContent).toMatch(/total pago/i);
    expect(termPanel.textContent).toMatch(/novo prazo/i);
    expect(termPanel.textContent).toMatch(/meses reduzidos/i);
    expect(termPanel.textContent).toMatch(/diferença vs\. base/i);
    // Both should contain BRL-formatted figures
    expect(termPanel.textContent).toMatch(/R\$\s?\d/);

    // Switch to reduce-installment tab
    fireEvent.click(installmentTab);
    await waitFor(() => {
      expect(installmentTab.getAttribute("aria-selected")).toBe("true");
    });
    const installmentPanel = screen.getByRole("tabpanel", {
      name: /reduzir parcela/i,
    });
    expect(installmentPanel.textContent).toMatch(/economia em juros/i);
    expect(installmentPanel.textContent).toMatch(/R\$\s?\d/);
  });

  it("recomputes immediately when the user changes the extra value", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Pagamento extra mensal");

    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    const termPanel = await screen.findByRole("tabpanel", {
      name: /reduzir prazo/i,
    });
    const initialText = termPanel.textContent ?? "";

    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(termPanel.textContent).not.toBe(initialText);
    });
  });

  it("does not show tabs when extra is set but financing is missing", async () => {
    renderCard({ financing: null });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByTestId("extra-state").textContent).toBe("500");
    });
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
    expect(
      screen.getByTestId("extra-payment-empty-state").textContent,
    ).toMatch(/preencha os dados do financiamento/i);
  });

  it("shows pt-BR error when extra is negative", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "-100" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(
        screen.getByText(/pagamento extra não pode ser negativo/i),
      ).toBeInTheDocument();
    });
    // Negative extra should not publish a positive value to context
    expect(screen.getByTestId("extra-state").textContent).toBe("null");
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
  });

  it("supports SAC system for prepayment results", async () => {
    renderCard({ financing: { ...defaultFinancing, system: "SAC" } });
    const input = screen.getByLabelText("Pagamento extra mensal");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    const termPanel = await screen.findByRole("tabpanel", {
      name: /reduzir prazo/i,
    });
    expect(termPanel.textContent).toMatch(/R\$\s?\d/);
  });
});
