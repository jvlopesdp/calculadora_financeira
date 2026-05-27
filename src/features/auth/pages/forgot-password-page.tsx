import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";

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
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/schemas/forgot-password";
import { authClient } from "@/lib/auth-client";

const GENERIC_SUCCESS_MESSAGE =
  "Se o email existir, enviaremos um link para redefinir a senha.";

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        const httpStatus =
          typeof (result.error as { status?: number }).status === "number"
            ? (result.error as { status?: number }).status
            : undefined;
        setStatus("error");
        setErrorMessage(
          httpStatus === 429
            ? "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente."
            : "Não foi possível enviar o email agora. Tente novamente em instantes.",
        );
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Erro de rede. Verifique sua conexão e tente novamente.",
      );
    }
  });

  const submitting = status === "submitting";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>
          Receba um link por email para redefinir sua senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "sent" ? (
          <div className="space-y-4">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-emerald-600 dark:text-emerald-400"
            >
              {GENERIC_SUCCESS_MESSAGE}
            </p>
            <p className="text-muted-foreground text-sm">
              Confira sua caixa de entrada e a pasta de spam. O link expira em
              1 hora.
            </p>
            <p className="text-muted-foreground text-center text-sm">
              <Link
                to="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Voltar para entrar
              </Link>
            </p>
          </div>
        ) : (
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

              {status === "error" && errorMessage ? (
                <p
                  role="alert"
                  className="text-destructive text-sm font-medium"
                >
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                aria-disabled={submitting}
              >
                {submitting ? "Enviando…" : "Enviar link de redefinição"}
              </Button>
            </form>
          </Form>
        )}

        {status !== "sent" ? (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Lembrou da senha?{" "}
            <Link
              to="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
