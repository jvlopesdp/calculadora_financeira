import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AccountPage } from "@/features/account/pages/account-page";
import { ApiError, type AccountApi } from "@/lib/api-client";

const useAccountMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const useUpdateAccountMock = vi.fn();

vi.mock("@/lib/queries/account", () => ({
  useAccount: () => useAccountMock(),
  useUpdateAccount: () => useUpdateAccountMock(),
}));

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

function renderPage() {
  return render(<AccountPage />);
}

describe("AccountPage", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    updateMutateAsyncMock.mockReset();
    useUpdateAccountMock.mockReset();
    setMutation();
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
});
