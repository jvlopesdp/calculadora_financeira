import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/app/protected-route";

const useSessionMock = vi.fn();

vi.mock("@/lib/queries/session", () => ({
  useSession: () => useSessionMock(),
}));

function LoginStub() {
  const [params] = useSearchParams();
  return <div data-testid="login-next">{params.get("next") ?? ""}</div>;
}

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
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
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
    expect(screen.queryByTestId("login-next")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to /login carrying the original path+search in ?next=", () => {
    useSessionMock.mockReturnValue({
      user: null,
      session: null,
      isPending: false,
      isError: false,
    });
    renderProtected("/historico/42?tab=pagamentos");
    expect(screen.getByTestId("login-next")).toHaveTextContent(
      "/historico/42?tab=pagamentos",
    );
    expect(screen.queryByText(/detalhe protegido/i)).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("login-next")).not.toBeInTheDocument();
  });
});
