import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { AppRoutes } from "@/app/routes";
import { ThemeProvider } from "@/components/theme-provider";
import { SimulationProvider } from "@/features/simulator/hooks/simulation-provider";

const useSessionMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
  },
}));

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

function setSession(value: {
  data: unknown;
  isPending: boolean;
  error?: Error | null;
}) {
  (useSessionMock as Mock).mockReturnValue({
    data: value.data,
    isPending: value.isPending,
    error: value.error ?? null,
  });
}

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <SimulationProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SimulationProvider>
    </ThemeProvider>,
  );
}

describe("AppRoutes", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    document.documentElement.classList.remove("dark");
    useSessionMock.mockReset();
    setSession({ data: null, isPending: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
  });

  it("redirects root to /financiamento", () => {
    renderAt("/");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /simulador de financiamento/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /premissas gerais/i }),
    ).toBeInTheDocument();
  });

  it("renders /financiamento under the app shell without requiring auth", () => {
    renderAt("/financiamento");
    expect(
      screen.getByRole("heading", { level: 3, name: /premissas gerais/i }),
    ).toBeInTheDocument();
  });

  it("renders /alugar-x-financiar under the app shell without requiring auth", () => {
    renderAt("/alugar-x-financiar");
    expect(
      screen.getByRole("heading", { level: 3, name: /alugar x financiar/i }),
    ).toBeInTheDocument();
  });

  it("redirects unauthenticated /historico to /login", () => {
    setSession({ data: null, isPending: false });
    renderAt("/historico");
    expect(
      screen.getByRole("heading", { level: 3, name: /^entrar$/i }),
    ).toBeInTheDocument();
  });

  it("shows a loading state on /historico while session is pending", () => {
    setSession({ data: null, isPending: true });
    renderAt("/historico");
    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
  });

  it("renders /historico content when authenticated", () => {
    setSession({
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
          ipAddress: "127.0.0.1",
          userAgent: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      isPending: false,
    });
    renderAt("/historico");
    expect(
      screen.getByRole("heading", { level: 3, name: /^histórico$/i }),
    ).toBeInTheDocument();
  });

  it("renders public auth routes with the auth layout (no app shell)", () => {
    renderAt("/login");
    expect(
      screen.getByRole("heading", { level: 3, name: /^entrar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: /simulador de financiamento/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the 404 page for unknown routes", () => {
    renderAt("/this-route-does-not-exist");
    expect(
      screen.getByRole("heading", { level: 1, name: /página não encontrada/i }),
    ).toBeInTheDocument();
  });
});
