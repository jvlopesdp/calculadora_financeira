import { useEffect } from "react";
import Decimal from "decimal.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TargetPaymentCard } from "@/features/simulator/components/target-payment-card";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import { calculatePriceInstallment } from "@/core/finance/price-calculator";
import { roundMoney } from "@/core/finance/financial-types";
import { formatBRL } from "@/lib/formatters/currency";

const defaultFinancing: FinancingFormValues = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 1,
  termMonths: 360,
  system: "PRICE",
};

const BASE_PRICE_INSTALLMENT = roundMoney(
  calculatePriceInstallment({
    principal: new Decimal(defaultFinancing.propertyValue).minus(
      defaultFinancing.downPayment,
    ),
    monthlyRate: new Decimal(defaultFinancing.monthlyRate).div(100),
    termMonths: defaultFinancing.termMonths,
  }),
);

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
      <TargetPaymentCard />
      <ExtraFingerprint />
    </SimulationProvider>,
  );
}

describe("TargetPaymentCard", () => {
  it("renders the pt-BR card title and target-payment input label", () => {
    renderCard();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /parcela mensal desejada/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Parcela mensal desejada"),
    ).toBeInTheDocument();
  });

  it("shows the no-financing empty state when financing is missing", () => {
    renderCard({ financing: null });
    expect(
      screen.getByTestId("target-payment-empty-state").textContent,
    ).toMatch(/preencha os dados do financiamento/i);
    expect(screen.queryByTestId("target-payment-min-helper")).toBeNull();
  });

  it("shows the parcela mínima helper text once financing is provided", () => {
    renderCard({ financing: defaultFinancing });
    const helper = screen.getByTestId("target-payment-min-helper");
    expect(helper.textContent).toMatch(/parcela mínima:/i);
    expect(helper.textContent).toContain("R$");
  });

  it("blocks values below the parcela base with an inline pt-BR error", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    const tooLow = BASE_PRICE_INSTALLMENT.minus(new Decimal(1));
    fireEvent.change(input, { target: { value: formatBRL(tooLow) } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByText(/parcela desejada deve ser ≥ r\$/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("extra-state").textContent).toBe("null");
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
    expect(
      screen.queryByTestId("target-payment-extra-calculated"),
    ).toBeNull();
  });

  it("derives extra = target − base and publishes it to the simulation context", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    const targetValue = BASE_PRICE_INSTALLMENT.plus(500);
    fireEvent.change(input, { target: { value: formatBRL(targetValue) } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByTestId("extra-state").textContent).toBe("500");
    });

    const extraInfo = screen.getByTestId("target-payment-extra-calculated");
    expect(extraInfo.textContent).toMatch(/extra calculado:/i);
    expect(extraInfo.textContent).toContain("R$");
  });

  it("renders both strategy tabs with results when target > base", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    const target = BASE_PRICE_INSTALLMENT.plus(500);
    fireEvent.change(input, { target: { value: formatBRL(target) } });
    fireEvent.blur(input);

    const termTab = await screen.findByRole("tab", { name: /reduzir prazo/i });
    const installmentTab = screen.getByRole("tab", {
      name: /reduzir parcela/i,
    });
    expect(termTab).toBeInTheDocument();
    expect(installmentTab).toBeInTheDocument();
    expect(termTab.getAttribute("aria-selected")).toBe("true");

    const termPanel = screen.getByRole("tabpanel", { name: /reduzir prazo/i });
    expect(termPanel.textContent).toMatch(/economia em juros/i);
    expect(termPanel.textContent).toMatch(/total pago/i);
    expect(termPanel.textContent).toMatch(/novo prazo/i);
    expect(termPanel.textContent).toMatch(/meses reduzidos/i);
    expect(termPanel.textContent).toMatch(/diferença vs\. base/i);
    expect(termPanel.textContent).toMatch(/R\$\s?\d/);

    fireEvent.click(installmentTab);
    await waitFor(() => {
      expect(installmentTab.getAttribute("aria-selected")).toBe("true");
    });
    const installmentPanel = screen.getByRole("tabpanel", {
      name: /reduzir parcela/i,
    });
    expect(installmentPanel.textContent).toMatch(/R\$\s?\d/);
  });

  it("treats target exactly equal to the base PRICE installment as zero extra (no tabs)", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    fireEvent.change(input, {
      target: { value: formatBRL(BASE_PRICE_INSTALLMENT) },
    });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByTestId("extra-state").textContent).toBe("0");
    });
    expect(
      screen.getByTestId("target-payment-empty-state").textContent,
    ).toMatch(/parcela mensal desejada superior à parcela mínima/i);
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
    expect(
      screen.queryByTestId("target-payment-extra-calculated"),
    ).toBeNull();
  });

  it("recomputes the schedule when the target value changes", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    const lowTarget = BASE_PRICE_INSTALLMENT.plus(500);
    fireEvent.change(input, { target: { value: formatBRL(lowTarget) } });
    fireEvent.blur(input);

    const termPanel = await screen.findByRole("tabpanel", {
      name: /reduzir prazo/i,
    });
    const initialText = termPanel.textContent ?? "";

    const highTarget = BASE_PRICE_INSTALLMENT.plus(2500);
    fireEvent.change(input, { target: { value: formatBRL(highTarget) } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(termPanel.textContent).not.toBe(initialText);
    });
  });

  it("does not show tabs when target is set but financing is missing", async () => {
    renderCard({ financing: null });
    const input = screen.getByLabelText("Parcela mensal desejada");
    fireEvent.change(input, { target: { value: "5000" } });
    fireEvent.blur(input);

    expect(
      screen.getByTestId("target-payment-empty-state").textContent,
    ).toMatch(/preencha os dados do financiamento/i);
    expect(screen.queryByRole("tab", { name: /reduzir prazo/i })).toBeNull();
    expect(screen.getByTestId("extra-state").textContent).toBe("null");
  });

  it("shows a pt-BR error when target is zero", async () => {
    renderCard({ financing: defaultFinancing });
    const input = screen.getByLabelText("Parcela mensal desejada");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByText(/parcela desejada deve ser maior que zero/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("extra-state").textContent).toBe("null");
  });
});
