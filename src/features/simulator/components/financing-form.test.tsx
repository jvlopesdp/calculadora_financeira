import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FinancingForm } from "@/features/simulator/components/financing-form";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";

// FinancingForm now consumes useSimulatorDraft (session + draft TanStack hooks).
// Mock the query layer so these tests stay anonymous and avoid network/QueryClient.
vi.mock("@/lib/queries/session", () => ({
  useSession: () => ({
    user: null,
    session: null,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/lib/queries/draft", () => ({
  useDraftQuery: () => ({ data: undefined, isSuccess: false }),
  useSaveDraft: () => ({ mutate: vi.fn() }),
}));

function FinancingFingerprint() {
  const { financing } = useSimulation();
  return (
    <div data-testid="financing-state">
      {financing ? JSON.stringify(financing) : "null"}
    </div>
  );
}

function renderForm() {
  return render(
    <SimulationProvider>
      <FinancingForm />
      <FinancingFingerprint />
    </SimulationProvider>,
  );
}

describe("FinancingForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders all required pt-BR labels", () => {
    renderForm();
    expect(screen.getByLabelText("Valor do imóvel")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor financiado")).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa mensal")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Taxa anual equivalente"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Prazo em meses")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Sistema de amortização"),
    ).toBeInTheDocument();
  });

  it("disables the submit button while the form is invalid", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: /simular/i }),
    ).toBeDisabled();
  });

  it("shows pt-BR error when down payment >= property value", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Taxa mensal"), {
      target: { value: "0,8" },
    });
    fireEvent.blur(screen.getByLabelText("Taxa mensal"));
    fireEvent.change(screen.getByLabelText("Prazo em meses"), {
      target: { value: "360" },
    });
    fireEvent.change(screen.getByLabelText("Valor do imóvel"), {
      target: { value: "100000" },
    });
    fireEvent.blur(screen.getByLabelText("Valor do imóvel"));
    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: "200000" },
    });
    fireEvent.blur(screen.getByLabelText("Entrada"));
    await waitFor(() => {
      expect(
        screen.getByText(/entrada deve ser menor que o valor do imóvel/i),
      ).toBeInTheDocument();
    });
  });

  it("shows pt-BR error when monthly rate is zero", async () => {
    renderForm();
    const rate = screen.getByLabelText("Taxa mensal");
    fireEvent.change(rate, { target: { value: "0" } });
    fireEvent.blur(rate);
    await waitFor(() => {
      expect(
        screen.getByText(/taxa mensal deve ser maior que zero/i),
      ).toBeInTheDocument();
    });
  });

  it("derives valor financiado and taxa anual equivalente reactively", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Valor do imóvel"), {
      target: { value: "500000" },
    });
    fireEvent.blur(screen.getByLabelText("Valor do imóvel"));
    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: "100000" },
    });
    fireEvent.blur(screen.getByLabelText("Entrada"));
    const financedOutput = screen.getByLabelText("Valor financiado");
    await waitFor(() => {
      expect(financedOutput.textContent).toMatch(/R\$ 400\.000,00/);
    });

    fireEvent.change(screen.getByLabelText("Taxa mensal"), {
      target: { value: "1" },
    });
    fireEvent.blur(screen.getByLabelText("Taxa mensal"));
    const annualOutput = screen.getByLabelText("Taxa anual equivalente");
    await waitFor(() => {
      expect(annualOutput.textContent).toMatch(/12,68/);
    });
  });

  it("enables submit and publishes values to useSimulation when valid", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Valor do imóvel"), {
      target: { value: "500000" },
    });
    fireEvent.blur(screen.getByLabelText("Valor do imóvel"));
    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: "100000" },
    });
    fireEvent.blur(screen.getByLabelText("Entrada"));
    fireEvent.change(screen.getByLabelText("Taxa mensal"), {
      target: { value: "0,8" },
    });
    fireEvent.blur(screen.getByLabelText("Taxa mensal"));
    fireEvent.change(screen.getByLabelText("Prazo em meses"), {
      target: { value: "360" },
    });
    fireEvent.change(screen.getByLabelText("Sistema de amortização"), {
      target: { value: "SAC" },
    });

    const submit = screen.getByRole("button", { name: /simular/i });
    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });

    fireEvent.click(submit);

    await waitFor(() => {
      const state = screen.getByTestId("financing-state").textContent ?? "";
      expect(state).not.toBe("null");
      const parsed = JSON.parse(state);
      expect(parsed).toMatchObject({
        propertyValue: 500000,
        downPayment: 100000,
        monthlyRate: 0.8,
        termMonths: 360,
        system: "SAC",
      });
    });
  });

  it("offers PRICE and SAC options in the amortization system selector", () => {
    renderForm();
    const select = screen.getByLabelText(
      "Sistema de amortização",
    ) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["PRICE", "SAC"]);
  });
});
