import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AccountPage } from "@/features/account/pages/account-page";
import { ApiError, type AccountApi } from "@/lib/api-client";

const useAccountMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const useUpdateAccountMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();
const useDeleteAccountMock = vi.fn();
const changePasswordMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/lib/queries/account", () => ({
  useAccount: () => useAccountMock(),
  useUpdateAccount: () => useUpdateAccountMock(),
  useDeleteAccount: () => useDeleteAccountMock(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: (...args: unknown[]) => changePasswordMock(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Passthrough Dialog mock: the Radix Dialog primitive uses portals + the
// pointer-capture API that jsdom doesn't ship. Render the content inline when
// `open` is true so fireEvent can click the confirm button directly.
vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Dialog: ({
      open,
      children,
    }: {
      open?: boolean;
      children?: ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: ({
      children,
      ...rest
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => <div {...rest}>{children}</div>,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: { children?: ReactNode }) => (
      <h3>{children}</h3>
    ),
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
    DialogTrigger: Passthrough,
  };
});

function makeAccount(overrides: Partial<AccountApi> = {}): AccountApi {
  return {
    id: "u_1",
    name: "Maria Silva",
    email: "maria@example.com",
    emailVerified: true,
    createdAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

function setAccount(value: {
  data?: AccountApi | null;
  isPending?: boolean;
  isError?: boolean;
}) {
  (useAccountMock as Mock).mockReturnValue({
    data: value.data ?? null,
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  });
}

function setMutation(state: { isPending?: boolean } = {}) {
  (useUpdateAccountMock as Mock).mockReturnValue({
    mutateAsync: updateMutateAsyncMock,
    isPending: state.isPending ?? false,
  });
}

function setDeleteMutation(state: { isPending?: boolean } = {}) {
  (useDeleteAccountMock as Mock).mockReturnValue({
    mutateAsync: deleteMutateAsyncMock,
    isPending: state.isPending ?? false,
  });
}

function renderPage() {
  return render(<AccountPage />);
}

describe("AccountPage", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    updateMutateAsyncMock.mockReset();
    useUpdateAccountMock.mockReset();
    deleteMutateAsyncMock.mockReset();
    useDeleteAccountMock.mockReset();
    changePasswordMock.mockReset();
    navigateMock.mockReset();
    setMutation();
    setDeleteMutation();
  });

  it("shows the loading state while the account query is pending", () => {
    setAccount({ isPending: true });
    renderPage();

    expect(screen.getByTestId("account-loading")).toBeInTheDocument();
  });

  it("shows the error state when the account query fails", () => {
    setAccount({ isError: true });
    renderPage();

    expect(screen.getByTestId("account-error")).toBeInTheDocument();
  });

  it("renders name, email and creation date for the authenticated user", () => {
    setAccount({ data: makeAccount() });
    renderPage();

    expect(
      screen.getByRole("heading", { name: /minha conta/i, level: 3 }),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Nome") as HTMLInputElement).value,
    ).toBe("Maria Silva");
    expect(
      (screen.getByLabelText("Email") as HTMLInputElement).value,
    ).toBe("maria@example.com");
    expect(screen.getByTestId("account-created-at").textContent).toMatch(
      /15\/01\/2026/,
    );
  });

  it("saves the new name through the unified PATCH endpoint", async () => {
    setAccount({ data: makeAccount() });
    updateMutateAsyncMock.mockResolvedValueOnce({
      account: makeAccount({ name: "Maria Nova" }),
      emailVerificationSent: false,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Maria Nova" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar alterações/i }),
    );

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        name: "Maria Nova",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("account-success")).toHaveTextContent(
        "Alterações salvas.",
      );
    });
  });

  it("flags pending email verification when the email changes", async () => {
    setAccount({ data: makeAccount() });
    updateMutateAsyncMock.mockResolvedValueOnce({
      account: makeAccount(),
      emailVerificationSent: true,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nova@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar alterações/i }),
    );

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        email: "nova@example.com",
      });
    });
    await waitFor(() => {
      const banner = screen.getByTestId("account-email-pending");
      expect(banner).toHaveTextContent("nova@example.com");
      expect(banner).toHaveTextContent("maria@example.com");
    });
  });

  it("does not call the mutation when nothing changed", async () => {
    setAccount({ data: makeAccount() });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /salvar alterações/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("account-success")).toHaveTextContent(
        "Nenhuma alteração para salvar.",
      );
    });
    expect(updateMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("surfaces the EMAIL_TAKEN error in pt-BR", async () => {
    setAccount({ data: makeAccount() });
    updateMutateAsyncMock.mockRejectedValueOnce(
      new ApiError("Request failed: 400 Bad Request", 400, {
        error: "EMAIL_TAKEN",
        message: "Email already in use",
      }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar alterações/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("account-error-message")).toHaveTextContent(
        /em uso por outra conta/i,
      );
    });
  });

  it("disables the submit button while the mutation is pending", () => {
    setAccount({ data: makeAccount() });
    setMutation({ isPending: true });
    renderPage();

    const button = screen.getByRole("button", { name: /salvando/i });
    expect(button).toBeDisabled();
  });

  it("validates inputs client-side before submitting", async () => {
    setAccount({ data: makeAccount() });
    renderPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar alterações/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Email inválido.")).toBeInTheDocument();
    });
    expect(updateMutateAsyncMock).not.toHaveBeenCalled();
  });

  describe("change password section", () => {
    function fillPasswords(values: {
      current: string;
      next: string;
      confirm: string;
    }) {
      fireEvent.change(screen.getByLabelText("Senha atual"), {
        target: { value: values.current },
      });
      fireEvent.change(screen.getByLabelText("Nova senha"), {
        target: { value: values.next },
      });
      fireEvent.change(screen.getByLabelText("Confirme a nova senha"), {
        target: { value: values.confirm },
      });
    }

    it("renders the change password section with the three required fields", () => {
      setAccount({ data: makeAccount() });
      renderPage();

      expect(
        screen.getByRole("heading", { name: /trocar senha/i, level: 3 }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
      expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Confirme a nova senha"),
      ).toBeInTheDocument();
    });

    it("blocks submission when the confirmation does not match", async () => {
      setAccount({ data: makeAccount() });
      renderPage();

      fillPasswords({
        current: "currentSecret123",
        next: "newSecret123!",
        confirm: "different123!",
      });
      fireEvent.click(screen.getByRole("button", { name: /trocar senha/i }));

      await waitFor(() => {
        expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument();
      });
      expect(changePasswordMock).not.toHaveBeenCalled();
    });

    it("blocks submission when the new password is shorter than 8 characters", async () => {
      setAccount({ data: makeAccount() });
      renderPage();

      fillPasswords({
        current: "currentSecret123",
        next: "short",
        confirm: "short",
      });
      fireEvent.click(screen.getByRole("button", { name: /trocar senha/i }));

      await waitFor(() => {
        expect(
          screen.getByText("A nova senha deve ter pelo menos 8 caracteres."),
        ).toBeInTheDocument();
      });
      expect(changePasswordMock).not.toHaveBeenCalled();
    });

    it("calls Better Auth changePassword with revokeOtherSessions and shows success feedback", async () => {
      setAccount({ data: makeAccount() });
      changePasswordMock.mockResolvedValueOnce({
        data: { token: "new-token" },
        error: null,
      });
      renderPage();

      fillPasswords({
        current: "currentSecret123",
        next: "brandNewSecret123!",
        confirm: "brandNewSecret123!",
      });
      fireEvent.click(screen.getByRole("button", { name: /trocar senha/i }));

      await waitFor(() => {
        expect(changePasswordMock).toHaveBeenCalledWith({
          currentPassword: "currentSecret123",
          newPassword: "brandNewSecret123!",
          revokeOtherSessions: true,
        });
      });
      await waitFor(() => {
        expect(
          screen.getByTestId("change-password-success"),
        ).toHaveTextContent(/senha trocada com sucesso/i);
      });

      expect(
        (screen.getByLabelText("Senha atual") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByLabelText("Nova senha") as HTMLInputElement).value,
      ).toBe("");
    });

    it("shows a clear error in pt-BR when the current password is wrong", async () => {
      setAccount({ data: makeAccount() });
      changePasswordMock.mockResolvedValueOnce({
        data: null,
        error: {
          code: "INVALID_PASSWORD",
          message: "Invalid password",
          status: 400,
        },
      });
      renderPage();

      fillPasswords({
        current: "wrongPassword!",
        next: "brandNewSecret123!",
        confirm: "brandNewSecret123!",
      });
      fireEvent.click(screen.getByRole("button", { name: /trocar senha/i }));

      await waitFor(() => {
        expect(screen.getByTestId("change-password-error")).toHaveTextContent(
          /senha atual está incorreta/i,
        );
      });
    });
  });

  describe("delete account section", () => {
    function openDeleteDialog() {
      fireEvent.click(screen.getByTestId("delete-account-trigger"));
      return screen.getByRole("dialog");
    }

    it("renders the danger zone card with an irreversibility warning", () => {
      setAccount({ data: makeAccount() });
      renderPage();

      const card = screen.getByTestId("delete-account-card");
      expect(
        within(card).getByRole("heading", {
          name: /excluir conta/i,
          level: 3,
        }),
      ).toBeInTheDocument();
      expect(card).toHaveTextContent(/permanente/i);
      expect(card).toHaveTextContent(/não há como desfazer/i);
      expect(screen.getByTestId("delete-account-trigger")).toBeInTheDocument();
    });

    it("opens the confirmation dialog and asks for reauthentication password", () => {
      setAccount({ data: makeAccount() });
      renderPage();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      const dialog = openDeleteDialog();
      expect(
        within(dialog).getByRole("heading", {
          name: /confirmar exclusão de conta/i,
        }),
      ).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Senha atual")).toBeInTheDocument();
      expect(
        within(dialog).getByTestId("delete-account-confirm"),
      ).toBeInTheDocument();
    });

    it("blocks submission with empty password and does not call the mutation", async () => {
      setAccount({ data: makeAccount() });
      renderPage();

      const dialog = openDeleteDialog();
      fireEvent.click(
        within(dialog).getByTestId("delete-account-confirm"),
      );

      await waitFor(() => {
        expect(
          within(dialog).getByText("Informe sua senha para confirmar."),
        ).toBeInTheDocument();
      });
      expect(deleteMutateAsyncMock).not.toHaveBeenCalled();
    });

    it("calls DELETE /api/account, ends the session and redirects to /login on success", async () => {
      setAccount({ data: makeAccount() });
      deleteMutateAsyncMock.mockResolvedValueOnce(undefined);
      renderPage();

      const dialog = openDeleteDialog();
      fireEvent.change(within(dialog).getByLabelText("Senha atual"), {
        target: { value: "correct-horse" },
      });
      fireEvent.click(
        within(dialog).getByTestId("delete-account-confirm"),
      );

      await waitFor(() => {
        expect(deleteMutateAsyncMock).toHaveBeenCalledWith({
          password: "correct-horse",
        });
      });
      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/login", {
          replace: true,
        });
      });
    });

    it("translates INVALID_PASSWORD to a clear pt-BR error inside the dialog", async () => {
      setAccount({ data: makeAccount() });
      deleteMutateAsyncMock.mockRejectedValueOnce(
        new ApiError("Request failed: 400 Bad Request", 400, {
          error: "INVALID_PASSWORD",
          message: "Invalid password",
        }),
      );
      renderPage();

      const dialog = openDeleteDialog();
      fireEvent.change(within(dialog).getByLabelText("Senha atual"), {
        target: { value: "wrong-pwd" },
      });
      fireEvent.click(
        within(dialog).getByTestId("delete-account-confirm"),
      );

      await waitFor(() => {
        expect(
          within(dialog).getByTestId("delete-account-error"),
        ).toHaveTextContent(/senha incorreta/i);
      });
      expect(navigateMock).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeInTheDocument();
    });

    it("disables the confirm button while the delete is in flight", () => {
      setAccount({ data: makeAccount() });
      setDeleteMutation({ isPending: true });
      renderPage();

      openDeleteDialog();
      const confirm = screen.getByTestId("delete-account-confirm");
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveTextContent(/excluindo/i);
    });
  });
});
