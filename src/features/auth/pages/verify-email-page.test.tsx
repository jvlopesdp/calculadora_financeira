import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";

const verifyEmailMock = vi.fn();
const sendVerificationEmailMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    verifyEmail: (...args: unknown[]) => verifyEmailMock(...args),
    sendVerificationEmail: (...args: unknown[]) =>
      sendVerificationEmailMock(...args),
  },
}));

function renderVerify(initialPath = "/verify-email?token=abc123") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    verifyEmailMock.mockReset();
    sendVerificationEmailMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("calls authClient.verifyEmail with the token from the query string on mount", async () => {
    verifyEmailMock.mockResolvedValueOnce({ data: { status: true }, error: null });
    renderVerify("/verify-email?token=tok-from-query");
    await waitFor(() => {
      expect(verifyEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(verifyEmailMock).toHaveBeenCalledWith({
      query: { token: "tok-from-query" },
    });
  });

  it("shows the success message and redirects to /login after 2s", async () => {
    verifyEmailMock.mockResolvedValueOnce({ data: { status: true }, error: null });
    renderVerify();
    expect(
      await screen.findByText(/email verificado! redirecionando/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/login page/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(await screen.findByText(/login page/i)).toBeInTheDocument();
  });

  it("shows pt-BR error for invalid/expired token and renders the resend form", async () => {
    verifyEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_TOKEN", message: "Invalid token" },
    });
    renderVerify();
    expect(
      await screen.findByText(/link de verificação inválido ou expirado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/reenviar email de verificação para/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reenviar email de verificação/i }),
    ).toBeInTheDocument();
  });

  it("shows the missing-token message and the resend form when no token is in the URL", async () => {
    renderVerify("/verify-email");
    expect(verifyEmailMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/parâmetro de token está ausente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/reenviar email de verificação para/i),
    ).toBeInTheDocument();
  });

  it("resend form calls authClient.sendVerificationEmail with the typed email", async () => {
    verifyEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "TOKEN_EXPIRED", message: "expired" },
    });
    sendVerificationEmailMock.mockResolvedValueOnce({ data: {}, error: null });
    renderVerify();

    await screen.findByText(/link de verificação inválido ou expirado/i);
    fireEvent.change(
      screen.getByLabelText(/reenviar email de verificação para/i),
      { target: { value: "reenvio@exemplo.com" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /reenviar email de verificação/i }),
    );
    await waitFor(() => {
      expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(sendVerificationEmailMock).toHaveBeenCalledWith({
      email: "reenvio@exemplo.com",
      callbackURL: "/login",
    });
    expect(
      await screen.findByText(/email reenviado/i),
    ).toBeInTheDocument();
  });

  it("resend form shows an inline error when the user submits without an email", async () => {
    verifyEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_TOKEN", message: "invalid" },
    });
    renderVerify();
    await screen.findByText(/link de verificação inválido ou expirado/i);
    fireEvent.click(
      screen.getByRole("button", { name: /reenviar email de verificação/i }),
    );
    expect(
      await screen.findByText(/informe seu email para receber um novo link/i),
    ).toBeInTheDocument();
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("surfaces a generic error message when verifyEmail throws", async () => {
    verifyEmailMock.mockRejectedValueOnce(new Error("Network down"));
    renderVerify();
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/reenviar email de verificação para/i),
    ).toBeInTheDocument();
  });
});
