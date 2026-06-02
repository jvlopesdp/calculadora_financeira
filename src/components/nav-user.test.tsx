import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";
import type { ReactNode } from "react";

import { NavUser } from "@/components/nav-user";
import { SidebarProvider } from "@/components/ui/sidebar";

const useSessionMock = vi.fn();
const signOutMutateMock = vi.fn();

vi.mock("@/lib/queries/session", () => ({
  useSession: () => useSessionMock(),
  useSignOut: () => ({ mutate: signOutMutateMock }),
}));

// Radix DropdownMenu relies on pointer-capture APIs and portals that are
// awkward in jsdom. For tests we replace it with a passthrough that always
// renders its menu content, so we can assert on the items and click handlers.
vi.mock("@/components/ui/dropdown-menu", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Item = ({
    children,
    onSelect,
    disabled,
  }: {
    children?: ReactNode;
    onSelect?: (event: Event) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onSelect?.(new Event("click"))}
    >
      {children}
    </button>
  );
  return {
    DropdownMenu: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuGroup: Passthrough,
    DropdownMenuItem: Item,
    DropdownMenuLabel: Passthrough,
    DropdownMenuSeparator: () => null,
  };
});

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

function renderNavUser(initialPath = "/financiamento") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SidebarProvider>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="*" element={<NavUser />} />
        </Routes>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

const authedSession = {
  data: {
    user: {
      id: "u_1",
      email: "user@example.com",
      name: "Joana",
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

describe("NavUser", () => {
  beforeEach(() => {
    stubMatchMedia();
    useSessionMock.mockReset();
    signOutMutateMock.mockReset();
  });

  it("renders an 'Entrar' button when anonymous and navigates to /login on click", () => {
    setSession({ data: null, isPending: false });
    renderNavUser("/financiamento");

    const entrar = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(entrar);

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("disables the entry button while the session is loading", () => {
    setSession({ data: null, isPending: true });
    renderNavUser("/financiamento");

    const entrar = screen.getByRole("button", { name: /carregando/i });
    expect(entrar).toBeDisabled();
  });

  it("renders the user display name and email when authenticated", () => {
    setSession(authedSession);
    renderNavUser("/financiamento");

    expect(screen.getAllByText("Joana").length).toBeGreaterThan(0);
    expect(screen.getAllByText("user@example.com").length).toBeGreaterThan(0);
  });

  it("falls back to the email when the user has no name", () => {
    setSession({
      data: {
        ...authedSession.data,
        user: { ...authedSession.data.user, name: "" },
      },
      isPending: false,
    });
    renderNavUser("/financiamento");

    expect(screen.getAllByText("user@example.com").length).toBeGreaterThan(0);
  });

  it("calls the sign-out mutation and navigates to /login on success", async () => {
    setSession(authedSession);

    (signOutMutateMock as MockedFunction<typeof signOutMutateMock>).mockImplementation(
      (_variables: unknown, opts: { onSuccess?: () => void } = {}) => {
        opts.onSuccess?.();
      },
    );

    renderNavUser("/financiamento");

    fireEvent.click(screen.getByRole("menuitem", { name: /sair/i }));

    expect(signOutMutateMock).toHaveBeenCalledTimes(1);
    const onSuccess = signOutMutateMock.mock.calls[0]?.[1]?.onSuccess as
      | (() => void)
      | undefined;
    expect(typeof onSuccess).toBe("function");

    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
