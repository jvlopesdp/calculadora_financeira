import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";

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
import { TurnstileField } from "@/features/auth/components/turnstile-field";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas/register";
import { authClient } from "@/lib/auth-client";

interface SignUpErrorBody {
  code?: string;
  message?: string;
  status?: number;
}

function translateSignUpError(error: SignUpErrorBody | null | undefined): string {
  if (!error) return "Não foi possível criar a conta. Tente novamente.";
  const code = typeof error.code === "string" ? error.code : "";
  if (code === "TURNSTILE_INVALID") {
    return "Verificação anti-bot inválida. Recarregue a página e tente novamente.";
  }
  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    return "Este email já está em uso. Tente entrar ou use outro endereço.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (code === "PASSWORD_TOO_LONG") {
    return "A senha é muito longa.";
  }
  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
  }
  return typeof error.message === "string" && error.message.length > 0
    ? error.message
    : "Não foi possível criar a conta. Tente novamente.";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
    },
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

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    if (!turnstileToken) {
      setFormError(
        "Aguarde a verificação anti-bot concluir antes de enviar o formulário.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email,
        callbackURL: "/login",
        // Extra field forwarded via fetchOptions.body so it survives the
        // strict-typed sign-up surface. Consumed by the Better Auth
        // before-hook in src/server/auth.ts and sent to Turnstile siteverify.
        fetchOptions: {
          body: { turnstileToken },
        },
      });
      if (result.error) {
        setFormError(translateSignUpError(result.error as SignUpErrorBody));
        return;
      }
      navigate("/check-email", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setFormError(
        message.length > 0
          ? message
          : "Erro de rede. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  const submitDisabled = submitting || !turnstileToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Cadastre-se para salvar seus financiamentos e simulações.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  <FormLabel>Confirme a senha</FormLabel>
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

            <TurnstileField
              onToken={handleToken}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
            />

            {formError ? (
              <p
                role="alert"
                className="text-destructive text-sm font-medium"
              >
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={submitDisabled}
              aria-disabled={submitDisabled}
            >
              {submitting ? "Criando conta…" : "Criar conta"}
            </Button>
          </form>
        </Form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
