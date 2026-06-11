import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageTitle, SiteHeader } from "@/components/site-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("@/features/historico/components/scenario-combobox", () => ({
  ScenarioCombobox: () => (
    <div data-testid="scenario-combobox">scenario-combobox</div>
  ),
}));

function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({
      matches: false,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

function renderHeader(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <Routes>
            <Route path="*" element={<SiteHeader />} />
          </Routes>
        </SidebarProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("getPageTitle", () => {
  it.each([
    ["/", "Financiamento"],
    ["/financiamento", "Financiamento"],
    ["/financiamento/qualquer-coisa", "Financiamento"],
    ["/meus-financiamentos", "Meus Financiamentos"],
    ["/meus-financiamentos/abc", "Meus Financiamentos"],
    ["/historico", "Meus Financiamentos"],
    ["/historico/abc", "Meus Financiamentos"],
    ["/acompanhamento", "Meus Financiamentos"],
    ["/acompanhamento/novo", "Meus Financiamentos"],
    ["/alugar-x-financiar", "Alugar x Financiar"],
    ["/conta", "Minha Conta"],
    ["/rota-desconhecida", "Calculadora Financeira"],
  ])("maps %s to %s", (path, expected) => {
    expect(getPageTitle(path)).toBe(expected);
  });
});

describe("SiteHeader", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it("renders the Financiamento title on /financiamento", () => {
    renderHeader("/financiamento");
    expect(
      screen.getByRole("heading", { name: "Financiamento" }),
    ).toBeInTheDocument();
  });

  it("renders the Meus Financiamentos title on /meus-financiamentos", () => {
    renderHeader("/meus-financiamentos");
    expect(
      screen.getByRole("heading", { name: "Meus Financiamentos" }),
    ).toBeInTheDocument();
  });

  it("renders the Meus Financiamentos title on the legacy /historico path", () => {
    renderHeader("/historico");
    expect(
      screen.getByRole("heading", { name: "Meus Financiamentos" }),
    ).toBeInTheDocument();
  });

  it("renders the Alugar x Financiar title on /alugar-x-financiar", () => {
    renderHeader("/alugar-x-financiar");
    expect(
      screen.getByRole("heading", { name: "Alugar x Financiar" }),
    ).toBeInTheDocument();
  });

  it("preserves the theme toggle", () => {
    renderHeader("/financiamento");
    expect(
      screen.getByRole("button", { name: /ativar modo/i }),
    ).toBeInTheDocument();
  });

  it("renders the scenario combobox when on /historico/:id", () => {
    renderHeader("/historico/sc_42");
    expect(screen.getByTestId("scenario-combobox")).toBeInTheDocument();
  });

  it("does not render the scenario combobox on /historico (list page)", () => {
    renderHeader("/historico");
    expect(screen.queryByTestId("scenario-combobox")).not.toBeInTheDocument();
  });

  it("does not render the scenario combobox on /financiamento", () => {
    renderHeader("/financiamento");
    expect(screen.queryByTestId("scenario-combobox")).not.toBeInTheDocument();
  });
});
