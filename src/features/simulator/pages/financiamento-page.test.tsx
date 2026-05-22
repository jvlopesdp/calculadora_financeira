import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/app/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { FinanciamentoPage } from "@/features/simulator/pages/financiamento-page";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";

type MediaQueryListener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(prefersDark: boolean) {
  const mql = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null as MediaQueryListener | null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => mql,
  });
}

function renderPage() {
  return render(
    <ThemeProvider>
      <SimulationProvider>
        <MemoryRouter initialEntries={["/financiamento"]}>
          <AppShell />
          <FinanciamentoPage />
        </MemoryRouter>
      </SimulationProvider>
    </ThemeProvider>,
  );
}

describe("Financiamento page", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
  });

  it("renders the shell header title and theme toggle", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^financiamento$/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /modo (escuro|claro)/i }),
    ).toBeInTheDocument();
  });

  it("renders the inputs panel (form + parcela desejada) and the results column in order", () => {
    renderPage();
    const sectionTitles = [
      "Financiamento",
      "Parcela mensal desejada",
      "Gráficos",
      "Tabela de amortização",
      "Resumo dos resultados",
    ];
    const rendered = screen
      .getAllByRole("heading", { level: 3 })
      .map((node) => node.textContent);
    expect(rendered).toEqual(sectionTitles);
  });

  it("renders the page-header export action with empty-state hint when no financing", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();
    expect(screen.getByTestId("export-empty-state").textContent).toMatch(
      /preencha os dados para habilitar a exportação/i,
    );
  });

  it("shows pt-BR empty-state bodies in the results cards before any input", () => {
    renderPage();
    const emptyStates = screen.getAllByText(/preencha os dados para simular/i);
    expect(emptyStates.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(
        /preencha os dados do financiamento para informar a parcela desejada/i,
      ),
    ).toBeInTheDocument();
  });

  it("uses theme tokens (bg-card, border-border) on every card", () => {
    const { container } = renderPage();
    const cards = container.querySelectorAll("div.bg-card");
    expect(cards.length).toBeGreaterThanOrEqual(6);
    cards.forEach((card) => {
      expect(card.className).toMatch(/bg-card/);
      expect(card.className).toMatch(/text-card-foreground/);
      expect(card.className).toMatch(/border-border/);
    });
  });

  it("renders the dashboard-01 site header with a bottom border", () => {
    const { container } = renderPage();
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/border-b/);
    expect(header?.className).toMatch(/h-\(--header-height\)/);
  });

  it("uses a 12-column grid layout above md breakpoint", () => {
    const { container } = renderPage();
    const grid = container.querySelector(
      "div.flex.flex-col.gap-6.md\\:grid",
    );
    expect(grid).not.toBeNull();
    expect(grid?.className).toMatch(/md:grid/);
    expect(grid?.className).toMatch(/md:grid-cols-12/);
    expect(grid?.className).toMatch(/flex-col/);
  });

  it("places the financing form inside an <aside> panel", () => {
    const { container } = renderPage();
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute("aria-label")).toMatch(/painel de inputs/i);
    expect(
      aside?.querySelector("form[aria-label='Formulário de financiamento']"),
    ).not.toBeNull();
  });
});
