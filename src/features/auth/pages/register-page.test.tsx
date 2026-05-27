import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterPage } from "@/features/auth/pages/register-page";

const signUpEmailMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) },
  },
}));

vi.mock("@/features/auth/components/turnstile-field", () => ({
  TurnstileField: ({ onToken }: { onToken: (token: string) => void }) => {
    return (
      <button
        type="button"
        data-testid="turnstile-stub"
        onClick={() => onToken("ts-token-123")}
      >
        Resolver Turnstile
      </button>
    );
  },
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/check-email" element={<div>Verifique seu email</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillForm({
  email = "novo@exemplo.com",
  password = "senha-segura-123",
  confirmation = "senha-segura-123",
} = {}) {
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^senha$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirme a senha/i), {
    target: { value: confirmation },
  });
}

describe("RegisterPage", () => {
  beforeEach(() => {
    signUpEmailMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form fields, turnstile widget, and link to login", () => {
    renderRegister();
    expect(
      screen.getByRole("heading", { level: 3, name: /criar conta/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirme a senha/i)).toBeInTheDocument();
    expect(screen.getByTestId("turnstile-stub")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /entrar/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("keeps the submit button disabled until turnstile resolves", () => {
    renderRegister();
    const submit = screen.getByRole("button", { name: /criar conta/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    expect(submit).toBeEnabled();
  });

  it("shows inline validation when passwords do not match", async () => {
    renderRegister();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm({ confirmation: "outra-senha-999" });
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      await screen.findByText(/as senhas não conferem/i),
    ).toBeInTheDocument();
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  it("shows inline validation when password is too short", async () => {
    renderRegister();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm({ password: "curto", confirmation: "curto" });
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      await screen.findByText(/pelo menos 8 caracteres/i),
    ).toBeInTheDocument();
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  it("submits sign-up payload with the turnstile token via fetchOptions.body and navigates to /check-email on success", async () => {
    signUpEmailMock.mockResolvedValueOnce({ data: {}, error: null });
    renderRegister();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpEmailMock).toHaveBeenCalledWith({
      email: "novo@exemplo.com",
      password: "senha-segura-123",
      name: "novo@exemplo.com",
      callbackURL: "/login",
      fetchOptions: { body: { turnstileToken: "ts-token-123" } },
    });
    expect(
      await screen.findByText(/verifique seu email/i),
    ).toBeInTheDocument();
  });

  it("translates known error codes (USER_ALREADY_EXISTS) to pt-BR", async () => {
    signUpEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "USER_ALREADY_EXISTS", message: "User already exists." },
    });
    renderRegister();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      await screen.findByText(/este email já está em uso/i),
    ).toBeInTheDocument();
  });

  it("translates TURNSTILE_INVALID errors", async () => {
    signUpEmailMock.mockResolvedValueOnce({
      data: null,
      error: { code: "TURNSTILE_INVALID", message: "anti-bot" },
    });
    renderRegister();
    fireEvent.click(screen.getByTestId("turnstile-stub"));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      await screen.findByText(/verificação anti-bot inválida/i),
    ).toBeInTheDocument();
  });
});
