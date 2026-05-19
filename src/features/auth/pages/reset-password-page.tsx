import { useState } from "react";
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
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/schemas/reset-password";
import { authClient } from "@/lib/auth-client";

interface ResetPasswordErrorBody {
  code?: string;
  message?: string;
  status?: number;
}

type ResetErrorKind =
  | { kind: "invalid_token" }
  | { kind: "password_too_short" }
  | { kind: "rate_limit" }
  | { kind: "generic"; message: string };

function classifyResetError(
  error: ResetPasswordErrorBody | null | undefined,
): ResetErrorKind {
  if (!error) {
    return {
      kind: "generic",
      message: "Não foi possível redefinir a senha. Tente novamente.",
    };
  }
  const code = typeof error.code === "string" ? error.code : "";
  if (
    code === "INVALID_TOKEN" ||
    code === "TOKEN_EXPIRED" ||
    code === "INVALID_VERIFICATION_TOKEN"
  ) {
    return { kind: "invalid_token" };
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return { kind: "password_too_short" };
  }
  if (error.status === 429) {
    return { kind: "rate_limit" };
  }
  return {
    kind: "generic",
    message:
      typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Não foi possível redefinir a senha. Tente novamente.",
  };
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const queryError = searchParams.get("error");

  const initialError: ResetErrorKind | null =
    queryError === "INVALID_TOKEN" ? { kind: "invalid_token" } : null;
  const [errorKind, setErrorKind] = useState<ResetErrorKind | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  const tokenInvalid = errorKind?.kind === "invalid_token";
  const missingToken = !token && !tokenInvalid;
  const showRequestNewLink = missingToken || tokenInvalid;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      setErrorKind({ kind: "invalid_token" });
      return;
    }
    setErrorKind(null);
    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token,
      });
      if (result.error) {
        setErrorKind(classifyResetError(result.error as ResetPasswordErrorBody));
        return;
      }
      const flash = encodeURIComponent(
        "Senha redefinida com sucesso. Entre com sua nova senha.",
      );
      navigate(`/login?flash=${flash}`, { replace: true });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>
          Escolha uma nova senha para sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showRequestNewLink ? (
          <div className="space-y-4">
            <p role="alert" className="text-destructive text-sm font-medium">
              {missingToken
                ? "Link inválido. O parâmetro de token está ausente na URL."
                : "Link de redefinição inválido ou expirado."}
            </p>
            <p className="text-muted-foreground text-sm">
              Solicite um novo link para continuar.
            </p>
            <div className="space-y-2 text-center text-sm">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Solicitar novo link
              </Link>
              <p className="text-muted-foreground">
                <Link
                  to="/login"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Voltar para entrar
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form className="space-y-4" onSubmit={onSubmit} noValidate>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Mínimo 8 caracteres"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirme a nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Digite a senha novamente"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {errorKind ? (
                  <p
                    role="alert"
                    className="text-destructive text-sm font-medium"
                  >
                    {errorKind.kind === "password_too_short"
                      ? "A senha deve ter pelo menos 8 caracteres."
                      : errorKind.kind === "rate_limit"
                        ? "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente."
                        : errorKind.message}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  aria-disabled={submitting}
                >
                  {submitting ? "Salvando…" : "Salvar nova senha"}
                </Button>
              </form>
            </Form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              <Link
                to="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Voltar para entrar
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
