import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type VerifyStatus =
  | { state: "verifying" }
  | { state: "success" }
  | { state: "missing-token" }
  | { state: "error"; message: string };

type ResendStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent" }
  | { state: "error"; message: string };

const REDIRECT_DELAY_MS = 2000;

function translateVerifyError(error: {
  code?: string;
  message?: string;
}): string {
  const code = typeof error.code === "string" ? error.code : "";
  if (
    code === "INVALID_TOKEN" ||
    code === "TOKEN_EXPIRED" ||
    code === "INVALID_VERIFICATION_TOKEN"
  ) {
    return "Link de verificação inválido ou expirado. Solicite um novo email abaixo.";
  }
  if (
    typeof error.message === "string" &&
    error.message.length > 0 &&
    error.message !== "null"
  ) {
    return error.message;
  }
  return "Não foi possível verificar seu email. Tente novamente ou solicite um novo link.";
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const verifyStartedRef = useRef(false);

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    token ? { state: "verifying" } : { state: "missing-token" },
  );
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<ResendStatus>({
    state: "idle",
  });

  useEffect(() => {
    if (!token) return;
    if (verifyStartedRef.current) return;
    verifyStartedRef.current = true;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      try {
        const result = await authClient.verifyEmail({ query: { token } });
        if (cancelled) return;
        if (result.error) {
          setVerifyStatus({
            state: "error",
            message: translateVerifyError(result.error),
          });
          return;
        }
        setVerifyStatus({ state: "success" });
        timeoutId = setTimeout(() => {
          if (!cancelled) navigate("/login", { replace: true });
        }, REDIRECT_DELAY_MS);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        setVerifyStatus({
          state: "error",
          message:
            message.length > 0
              ? message
              : "Erro de rede. Verifique sua conexão e tente novamente.",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [token, navigate]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resendEmail) {
      setResendStatus({
        state: "error",
        message: "Informe seu email para receber um novo link.",
      });
      return;
    }
    setResendStatus({ state: "sending" });
    try {
      const result = await authClient.sendVerificationEmail({
        email: resendEmail,
        callbackURL: "/login",
      });
      if (result.error) {
        setResendStatus({
          state: "error",
          message:
            typeof result.error.message === "string" &&
            result.error.message.length > 0
              ? result.error.message
              : "Não foi possível reenviar o email. Tente novamente.",
        });
        return;
      }
      setResendStatus({ state: "sent" });
    } catch {
      setResendStatus({
        state: "error",
        message: "Erro de rede. Verifique sua conexão e tente novamente.",
      });
    }
  }

  const showResendForm =
    verifyStatus.state === "error" || verifyStatus.state === "missing-token";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificar email</CardTitle>
        <CardDescription>
          {verifyStatus.state === "verifying"
            ? "Validando seu link de confirmação…"
            : verifyStatus.state === "success"
              ? "Tudo certo com seu email."
              : "Não conseguimos confirmar este link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {verifyStatus.state === "verifying" ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            Aguarde enquanto verificamos seu email…
          </p>
        ) : null}

        {verifyStatus.state === "success" ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-emerald-600 dark:text-emerald-400"
          >
            Email verificado! Redirecionando para o login…
          </p>
        ) : null}

        {verifyStatus.state === "missing-token" ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            Link de verificação inválido. O parâmetro de token está ausente na
            URL. Solicite um novo email abaixo.
          </p>
        ) : null}

        {verifyStatus.state === "error" ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {verifyStatus.message}
          </p>
        ) : null}

        {showResendForm ? (
          <form className="space-y-3" onSubmit={handleResend} noValidate>
            <div className="space-y-2">
              <Label htmlFor="verify-resend-email">
                Reenviar email de verificação para
              </Label>
              <Input
                id="verify-resend-email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={resendStatus.state === "sending"}
            >
              {resendStatus.state === "sending"
                ? "Reenviando…"
                : "Reenviar email de verificação"}
            </Button>
            {resendStatus.state === "sent" ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Email reenviado. Confira sua caixa de entrada e a pasta de
                spam.
              </p>
            ) : null}
            {resendStatus.state === "error" ? (
              <p
                role="alert"
                className="text-destructive text-sm font-medium"
              >
                {resendStatus.message}
              </p>
            ) : null}
          </form>
        ) : null}

        <p className="text-muted-foreground text-center text-sm">
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Voltar para entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
