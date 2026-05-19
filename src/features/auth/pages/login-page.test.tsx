import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/pages/login-page";

const signInEmailMock = vi.fn();
const sendVerificationEmailMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmailMock(...args) },
    sendVerificationEmail: (...args: unknown[]) =>
      sendVerificationEmailMock(...args),
  },
}));

vi.mock("@/features/auth/components/turnstile-field", () => ({
  TurnstileField: ({ onToken }: { onToken: (token: string) => void }) => {
    return (
      <button
        type="button"
        data-testid="turnstile-stub"
        onClick={() => onToken("ts-token-abc")}
      >
        Resolver Turnstile
      </button>
    );
  },
}));

function renderLogin(initialEntries: Array<string | { pathname: string; state: unknown }> = ["/login"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/financiamento" element={<div>Financiamento page</div>} />
        <Route path="/historico" element={<div>Historico page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
        <Route
          path="/forgot-password"
          element={<div>Forgot password page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function fillForm({
  email = "joao@exemplo.com",
  password = "senha-segura-123",
} = {}) {
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^senha$/i), {
    target: { value: password },
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    signInEmailMock.mockReset();
    sendVerificationEmailMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form fields, turnstile widget, and the navigation links", () => {
    renderLogin();
    expect(
      screen.getByRole("heading", { level: 3, name: /^entrar$/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByTestId("turnstile-stub")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /esqueci minha senha/i }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: /criar conta/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("keeps the submit button disabled until turnstile resolves", () => {
    renderLogin();
    const submit = screen.getByRole("button", { name: /^entrar$/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    expect(submit).toBeEnabled();
  });

  it("shows inline validation when the email is missing", async () => {
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm({ email: "" });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(
      await screen.findByText(/informe seu email/i),
    ).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it("submits sign-in payload with the turnstile token and navigates to /financiamento on success", async () => {
    signInEmailMock.mockResolvedValueOnce({ data: {}, error: null });
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(signInEmailMock).toHaveBeenCalledWith({
      email: "joao@exemplo.com",
      password: "senha-segura-123",
      callbackURL: "/financiamento",
      fetchOptions: { body: { turnstileToken: "ts-token-abc" } },
    });
    expect(
      await screen.findByText(/financiamento page/i),
    ).toBeInTheDocument();
  });

  it("honours the original destination passed via location.state.from after successful login", async () => {
    signInEmailMock.mockResolvedValueOnce({ data: {}, error: null });
    renderLogin([{ pathname: "/login", state: { from: "/historico" } }]);
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(signInEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/historico" }),
    );
    expect(await screen.findByText(/historico page/i)).toBeInTheDocument();
  });

  it("shows pt-BR error when credentials are invalid", async () => {
    signInEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "invalid" },
    });
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(
      await screen.findByText(/email ou senha incorretos/i),
    ).toBeInTheDocument();
  });

  it("shows the email-not-verified message with a 'reenviar' button that calls sendVerificationEmail", async () => {
    signInEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "not verified" },
    });
    sendVerificationEmailMock.mockResolvedValueOnce({
      data: {},
      error: null,
    });
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm({ email: "naoverificado@exemplo.com" });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(
      await screen.findByText(/email ainda não foi verificado/i),
    ).toBeInTheDocument();
    const resend = screen.getByRole("button", {
      name: /reenviar email de verificação/i,
    });
    fireEvent.click(resend);
    await waitFor(() => {
      expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(sendVerificationEmailMock).toHaveBeenCalledWith({
      email: "naoverificado@exemplo.com",
      callbackURL: "/login",
    });
    expect(
      await screen.findByText(/email reenviado/i),
    ).toBeInTheDocument();
  });

  it("shows a rate-limit message when the API returns status 429", async () => {
    signInEmailMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Too many requests", status: 429 },
    });
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(
      await screen.findByText(/muitas tentativas/i),
    ).toBeInTheDocument();
  });

  it("renders the flash querystring message above the form", () => {
    renderLogin([
      `/login?flash=${encodeURIComponent("Senha redefinida com sucesso. Entre com sua nova senha.")}`,
    ]);
    expect(
      screen.getByText(/senha redefinida com sucesso/i),
    ).toBeInTheDocument();
  });

  it("translates TURNSTILE_INVALID errors to pt-BR", async () => {
    signInEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "TURNSTILE_INVALID", message: "anti-bot" },
    });
    renderLogin();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(
      await screen.findByText(/verificação anti-bot inválida/i),
    ).toBeInTheDocument();
  });
});
