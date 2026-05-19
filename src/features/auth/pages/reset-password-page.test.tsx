import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";

const resetPasswordMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
  },
}));

function renderReset(search = "?token=valid-token") {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />
        <Route
          path="/login"
          element={<div data-testid="login-page">Login page</div>}
        />
        <Route
          path="/forgot-password"
          element={<div>Forgot password page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function fillForm({
  password = "nova-senha-123",
  confirmation = "nova-senha-123",
} = {}) {
  fireEvent.change(screen.getByLabelText(/^nova senha$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirme a nova senha/i), {
    target: { value: confirmation },
  });
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form when token is present", () => {
    renderReset();
    expect(
      screen.getByRole("heading", { level: 3, name: /redefinir senha/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^nova senha$/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/confirme a nova senha/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    ).toBeInTheDocument();
  });

  it("shows 'request new link' state when token is missing", () => {
    renderReset("");
    expect(
      screen.getByText(/parâmetro de token está ausente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /solicitar novo link/i }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText(/nova senha$/i)).not.toBeInTheDocument();
  });

  it("shows 'request new link' state when query carries ?error=INVALID_TOKEN", () => {
    renderReset("?error=INVALID_TOKEN");
    expect(
      screen.getByText(/link de redefinição inválido ou expirado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /solicitar novo link/i }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText(/nova senha$/i)).not.toBeInTheDocument();
  });

  it("shows inline validation when passwords do not match", async () => {
    renderReset();
    fillForm({ confirmation: "outra-senha-999" });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/as senhas não conferem/i),
    ).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("shows inline validation when password is too short", async () => {
    renderReset();
    fillForm({ password: "curto", confirmation: "curto" });
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/pelo menos 8 caracteres/i),
    ).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("submits newPassword + token and navigates to /login with a flash querystring on success", async () => {
    resetPasswordMock.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    renderReset("?token=valid-token-abc");
    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledTimes(1);
    });
    expect(resetPasswordMock).toHaveBeenCalledWith({
      newPassword: "nova-senha-123",
      token: "valid-token-abc",
    });
    const loginPage = await screen.findByTestId("login-page");
    expect(loginPage).toBeInTheDocument();
  });

  it("renders the 'request new link' UI when server returns INVALID_TOKEN", async () => {
    resetPasswordMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_TOKEN", message: "Invalid token" },
    });
    renderReset();
    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/link de redefinição inválido ou expirado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /solicitar novo link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("translates PASSWORD_TOO_SHORT errors to pt-BR", async () => {
    resetPasswordMock.mockResolvedValueOnce({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT", message: "too short" },
    });
    renderReset();
    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/pelo menos 8 caracteres/i),
    ).toBeInTheDocument();
  });

  it("translates rate-limit (status 429) errors to pt-BR", async () => {
    resetPasswordMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Too many requests", status: 429 },
    });
    renderReset();
    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/muitas tentativas/i),
    ).toBeInTheDocument();
  });

  it("surfaces a generic error message for unknown failures", async () => {
    resetPasswordMock.mockResolvedValueOnce({
      data: null,
      error: { code: "UNEXPECTED", message: "Something went wrong" },
    });
    renderReset();
    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /salvar nova senha/i }),
    );
    expect(
      await screen.findByText(/something went wrong/i),
    ).toBeInTheDocument();
  });
});
