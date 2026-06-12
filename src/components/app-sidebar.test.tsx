import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const signOutMutateMock = vi.fn();

vi.mock("@/lib/queries/session", () => ({
  useSession: () => ({ user: null, session: null, isPending: false, isError: false }),
  useSignOut: () => ({ mutate: signOutMutateMock }),
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

function renderSidebar(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it("renders the brand header with the simulator link", () => {
    renderSidebar("/financiamento");
    const brand = screen.getByRole("link", { name: /calculadora financeira/i });
    expect(brand).toHaveAttribute("href", "/financiamento");
  });

  it("renders all nav items for anonymous users", () => {
    renderSidebar("/financiamento");
    expect(screen.getByText("Financiamento")).toBeInTheDocument();
    expect(screen.getByText("Meus Financiamentos")).toBeInTheDocument();
    expect(screen.getByText("Alugar x Financiar")).toBeInTheDocument();
  });

  it("does not render the legacy Histórico / Acompanhamento nav items", () => {
    renderSidebar("/financiamento");
    expect(screen.queryByText("Histórico")).not.toBeInTheDocument();
    expect(screen.queryByText("Acompanhamento")).not.toBeInTheDocument();
  });

  it("links 'Meus Financiamentos' to /meus-financiamentos", () => {
    renderSidebar("/financiamento");
    const link = screen.getByText("Meus Financiamentos").closest("a");
    expect(link).toHaveAttribute("href", "/meus-financiamentos");
  });

  it("does not render legacy navDocuments labels", () => {
    renderSidebar("/financiamento");
    expect(screen.queryByText("Documentos")).not.toBeInTheDocument();
    expect(screen.queryByText("Gráficos")).not.toBeInTheDocument();
    expect(screen.queryByText("Início")).not.toBeInTheDocument();
  });

  it("marks the active route via NavLink so the corresponding button gets data-active", () => {
    renderSidebar("/alugar-x-financiar");
    const link = screen
      .getByText("Alugar x Financiar")
      .closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveClass("active");
  });

  it("navigates via react-router links (no full page reload)", () => {
    renderSidebar("/financiamento");
    const financiamento = screen
      .getByText("Financiamento")
      .closest("a");
    expect(financiamento).toHaveAttribute("href", "/financiamento");
    const alugar = screen
      .getByText("Alugar x Financiar")
      .closest("a");
    expect(alugar).toHaveAttribute("href", "/alugar-x-financiar");
  });
});
