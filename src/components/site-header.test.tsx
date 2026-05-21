import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { getPageTitle, SiteHeader } from "@/components/site-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";

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
          <SiteHeader />
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
    ["/historico", "Histórico"],
    ["/historico/abc", "Histórico"],
    ["/alugar-x-financiar", "Alugar x Financiar"],
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

  it("renders the Histórico title on /historico", () => {
    renderHeader("/historico");
    expect(
      screen.getByRole("heading", { name: "Histórico" }),
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
});
