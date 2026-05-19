import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";

const requestPasswordResetMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: (...args: unknown[]) =>
      requestPasswordResetMock(...args),
  },
}));

function renderForgot() {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the email input and login link", () => {
    renderForgot();
    expect(
      screen.getByRole("heading", { level: 3, name: /esqueci minha senha/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /entrar/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows inline validation when email is missing", async () => {
    renderForgot();
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(
      await screen.findByText(/informe seu email/i),
    ).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("shows inline validation for an invalid email", async () => {
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(await screen.findByText(/email inválido/i)).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("submits with email + redirectTo and shows the generic success message", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "joao@exemplo.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledTimes(1);
    });
    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      email: "joao@exemplo.com",
      redirectTo: "/reset-password",
    });
    expect(
      await screen.findByText(
        /se o email existir, enviaremos um link para redefinir a senha/i,
      ),
    ).toBeInTheDocument();
    // form fields should be replaced by the success state
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
  });

  it("does not reveal account existence on success — the generic message is identical regardless of email", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "naoexiste@exemplo.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(
      await screen.findByText(
        /se o email existir, enviaremos um link para redefinir a senha/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows a rate-limit message on status 429", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Too many requests", status: 429 },
    });
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "joao@exemplo.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(
      await screen.findByText(/muitas tentativas/i),
    ).toBeInTheDocument();
  });

  it("shows a generic error when the server returns an unexpected failure", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "boom", status: 500 },
    });
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "joao@exemplo.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(
      await screen.findByText(/não foi possível enviar o email agora/i),
    ).toBeInTheDocument();
  });

  it("shows a network error message when the call rejects", async () => {
    requestPasswordResetMock.mockRejectedValueOnce(new Error("network"));
    renderForgot();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "joao@exemplo.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar link de redefinição/i }),
    );
    expect(
      await screen.findByText(/erro de rede/i),
    ).toBeInTheDocument();
  });
});
