import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const useSessionMock = vi.fn();
const signOutMutateMock = vi.fn();

vi.mock("@/lib/queries/session", () => ({
  useSession: () => useSessionMock(),
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

function setSession(value: {
  data: { user?: unknown; session?: unknown } | null;
  isPending: boolean;
  isError?: boolean;
}) {
  (useSessionMock as Mock).mockReturnValue({
    user: value.data?.user ?? null,
    session: value.data?.session ?? null,
    isPending: value.isPending,
    isError: value.isError ?? false,
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

const authedSession = {
  data: {
    user: {
      id: "u_1",
      email: "user@example.com",
      name: "Usuário",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "s_1",
      userId: "u_1",
      token: "t",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  isPending: false,
};

describe("AppSidebar", () => {
  beforeEach(() => {
    stubMatchMedia();
    useSessionMock.mockReset();
    setSession({ data: null, isPending: false });
  });

  it("renders the brand header with the simulator link", () => {
    renderSidebar("/financiamento");
    const brand = screen.getByRole("link", { name: /calculadora financeira/i });
    expect(brand).toHaveAttribute("href", "/financiamento");
  });

  it("renders Financiamento and Alugar x Financiar for anonymous users", () => {
    renderSidebar("/financiamento");
    expect(screen.getByText("Financiamento")).toBeInTheDocument();
    expect(screen.getByText("Alugar x Financiar")).toBeInTheDocument();
  });

  it("hides the Histórico and Acompanhamento items for anonymous users", () => {
    setSession({ data: null, isPending: false });
    renderSidebar("/financiamento");
    expect(screen.queryByText("Histórico")).not.toBeInTheDocument();
    expect(screen.queryByText("Acompanhamento")).not.toBeInTheDocument();
  });

  it("shows the Histórico and Acompanhamento items for authenticated users", () => {
    setSession(authedSession);
    renderSidebar("/financiamento");
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText("Acompanhamento")).toBeInTheDocument();
  });

  it("does not render legacy navDocuments labels", () => {
    setSession(authedSession);
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
