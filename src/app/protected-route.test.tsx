import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/app/protected-route";

const useSessionMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/lib/queries/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigateMock };
});

// Stub do Dialog para evitar portal/pointer-capture do Radix em jsdom
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function renderProtected(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/historico" element={<div>Conteúdo protegido</div>} />
          <Route
            path="/historico/:id"
            element={<div>Detalhe protegido</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    navigateMock.mockReset();
  });

  it("renders a loader while the session is pending", () => {
    useSessionMock.mockReturnValue({
      user: null,
      session: null,
      isPending: true,
      isError: false,
    });
    renderProtected("/historico");
    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
    expect(screen.queryByText(/conteúdo protegido/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows modal with login prompt for unauthenticated users while keeping content behind", () => {
    useSessionMock.mockReturnValue({
      user: null,
      session: null,
      isPending: false,
      isError: false,
    });
    renderProtected("/historico");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/conteúdo exclusivo para cadastrados/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar na minha conta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar conta gratuita/i })).toBeInTheDocument();
  });

  it("navigates to /login with ?next= when unauthenticated user clicks login", () => {
    useSessionMock.mockReturnValue({
      user: null,
      session: null,
      isPending: false,
      isError: false,
    });
    renderProtected("/historico");
    screen.getByRole("button", { name: /entrar na minha conta/i }).click();
    expect(navigateMock).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/historico")}`,
    );
  });

  it("renders the child route when a user is present", () => {
    useSessionMock.mockReturnValue({
      user: { id: "u_1" },
      session: { id: "s_1" },
      isPending: false,
      isError: false,
    });
    renderProtected("/historico");
    expect(screen.getByText(/conteúdo protegido/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
