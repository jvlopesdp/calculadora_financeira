import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { TurnstileField } from "@/features/auth/components/turnstile-field";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/login";
import { authClient } from "@/lib/auth-client";

interface SignInErrorBody {
  code?: string;
  message?: string;
  status?: number;
}

type LoginErrorKind =
  | { kind: "invalid_credentials" }
  | { kind: "email_not_verified" }
  | { kind: "rate_limit" }
  | { kind: "turnstile" }
  | { kind: "generic"; message: string };

function classifySignInError(
  error: SignInErrorBody | null | undefined,
): LoginErrorKind {
  if (!error) {
    return { kind: "generic", message: "Não foi possível entrar. Tente novamente." };
  }
  const code = typeof error.code === "string" ? error.code : "";
  if (code === "TURNSTILE_INVALID") {
    return { kind: "turnstile" };
  }
  if (error.status === 429) {
    return { kind: "rate_limit" };
  }
  if (
    code === "EMAIL_NOT_VERIFIED" ||
    code === "USER_EMAIL_NOT_VERIFIED"
  ) {
    return { kind: "email_not_verified" };
  }
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    code === "INVALID_PASSWORD" ||
    code === "USER_NOT_FOUND"
  ) {
    return { kind: "invalid_credentials" };
  }
  return {
    kind: "generic",
    message:
      typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Não foi possível entrar. Tente novamente.",
  };
}

function resolveRedirectTarget(next: string | null): string {
  if (
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//")
  ) {
    return next;
  }
  return "/historico";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flashMessage = searchParams.get("flash");
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(
    searchParams.get("verified") === "1",
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LoginErrorKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const handleToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);
  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  useEffect(() => {
    if (!showVerifiedBanner) return;
    const timeoutId = setTimeout(() => setShowVerifiedBanner(false), 8000);
    return () => clearTimeout(timeoutId);
  }, [showVerifiedBanner]);

  const redirectTarget = resolveRedirectTarget(searchParams.get("next"));

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorKind(null);
    setResendStatus("idle");
    setShowVerifiedBanner(false);
    if (!turnstileToken) {
      setErrorKind({
        kind: "generic",
        message:
          "Aguarde a verificação anti-bot concluir antes de enviar o formulário.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: redirectTarget,
        fetchOptions: {
          body: { turnstileToken },
        },
      });
      if (result.error) {
        setErrorKind(classifySignInError(result.error as SignInErrorBody));
        return;
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setErrorKind({
        kind: "generic",
        message:
          message.length > 0
            ? message
            : "Erro de rede. Verifique sua conexão e tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleResendVerification = useCallback(async () => {
    const email = form.getValues("email");
    if (!email || resendStatus === "sending") return;
    setResendStatus("sending");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/login",
      });
      if (result.error) {
        setResendStatus("error");
        return;
      }
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  }, [form, resendStatus]);

  const submitDisabled = submitting || !turnstileToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Acesse sua conta para acompanhar seus financiamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {flashMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="mb-4 text-sm text-emerald-600 dark:text-emerald-400"
          >
            {flashMessage}
          </p>
        ) : null}
        {showVerifiedBanner ? (
          <p
            role="status"
            aria-live="polite"
            className="mb-4 text-sm text-emerald-600 dark:text-emerald-400"
          >
            Seu e-mail foi verificado. Entre com seu acesso.
          </p>
        ) : null}
        <GoogleSignInButton next={searchParams.get("next")} />
        <Form {...form}>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-right text-sm">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>

            <TurnstileField
              onToken={handleToken}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
            />

            {errorKind ? (
              <div role="alert" className="space-y-2">
                <p className="text-destructive text-sm font-medium">
                  {errorKind.kind === "invalid_credentials"
                    ? "Email ou senha incorretos."
                    : errorKind.kind === "email_not_verified"
                      ? "Seu email ainda não foi verificado. Verifique sua caixa de entrada ou reenvie o link de confirmação."
                      : errorKind.kind === "rate_limit"
                        ? "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente."
                        : errorKind.kind === "turnstile"
                          ? "Verificação anti-bot inválida. Recarregue a página e tente novamente."
                          : errorKind.message}
                </p>
                {errorKind.kind === "email_not_verified" ? (
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendStatus === "sending"}
                    >
                      {resendStatus === "sending"
                        ? "Reenviando…"
                        : "Reenviar email de verificação"}
                    </Button>
                    {resendStatus === "sent" ? (
                      <p className="text-muted-foreground text-xs">
                        Email reenviado. Verifique sua caixa de entrada.
                      </p>
                    ) : null}
                    {resendStatus === "error" ? (
                      <p className="text-destructive text-xs">
                        Não foi possível reenviar o email. Tente novamente.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={submitDisabled}
              aria-disabled={submitDisabled}
            >
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </Form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Não tem conta?{" "}
          <Link
            to="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
