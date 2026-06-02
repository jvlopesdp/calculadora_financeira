import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcompanhamentoNovoPage } from "@/features/acompanhamento/pages/acompanhamento-novo-page";
import type { TrackerPlanApi } from "@/lib/api-client";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateMock };
});

const fetchMock = vi.fn();

function createdPlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_new",
    user_id: "u_1",
    name: "Meu plano",
    property_value_cents: 500_000_00,
    down_payment_cents: 100_000_00,
    term_months: 360,
    annual_rate_bp: 1000,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 4_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function mockFetchResolve(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AcompanhamentoNovoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nome do plano"), {
    target: { value: "Meu plano" },
  });
  fireEvent.change(screen.getByLabelText("Valor do imóvel"), {
    target: { value: "500000" },
  });
  fireEvent.blur(screen.getByLabelText("Valor do imóvel"));
  fireEvent.change(screen.getByLabelText("Entrada"), {
    target: { value: "100000" },
  });
  fireEvent.blur(screen.getByLabelText("Entrada"));
  fireEvent.change(screen.getByLabelText("Prazo (meses)"), {
    target: { value: "360" },
  });
  fireEvent.change(screen.getByLabelText("Taxa anual"), {
    target: { value: "10" },
  });
  fireEvent.blur(screen.getByLabelText("Taxa anual"));
  fireEvent.change(screen.getByLabelText("Data de início"), {
    target: { value: "2025-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Valor-meta mensal"), {
    target: { value: "4000" },
  });
  fireEvent.blur(screen.getByLabelText("Valor-meta mensal"));
}

describe("AcompanhamentoNovoPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all the form fields", () => {
    renderPage();
    expect(screen.getByLabelText("Nome do plano")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor do imóvel")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada")).toBeInTheDocument();
    expect(screen.getByLabelText("Prazo (meses)")).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa anual")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Sistema de amortização"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Data de início")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor-meta mensal")).toBeInTheDocument();
  });

  it("POSTs the form and navigates to the new plan on success", async () => {
    mockFetchResolve(201, { plan: createdPlan() });
    renderPage();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/acompanhamento/tp_new");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tracker/plans");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Meu plano",
      propertyValue: 500000,
      downPayment: 100000,
      termMonths: 360,
      annualRate: 10,
      modality: "PRICE",
      startDate: "2025-01-01",
      targetMonthlyTotal: 4000,
    });
  });

  it("shows validation errors and does not call fetch on an empty submit", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await waitFor(() => {
      expect(
        screen.getByText("Informe um nome para o plano."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Valor do imóvel deve ser maior que zero."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("maps a server 422 down-payment error to the field message", async () => {
    mockFetchResolve(422, {
      error: "validation",
      message: "down_payment_must_be_less_than_property_value",
    });
    renderPage();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await waitFor(() => {
      expect(
        screen.getByText("Entrada deve ser menor que o valor do imóvel."),
      ).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
