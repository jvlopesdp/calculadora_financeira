import { useState } from "react";
import { Link } from "react-router-dom";

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

export function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "sending" }
    | { state: "sent" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      setStatus({ state: "error", message: "Informe seu email para reenviar." });
      return;
    }
    setStatus({ state: "sending" });
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/login",
      });
      if (result.error) {
        setStatus({
          state: "error",
          message:
            typeof result.error.message === "string" &&
            result.error.message.length > 0
              ? result.error.message
              : "Não foi possível reenviar o email. Tente novamente.",
        });
        return;
      }
      setStatus({ state: "sent" });
    } catch {
      setStatus({
        state: "error",
        message: "Erro de rede. Verifique sua conexão e tente novamente.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifique seu email</CardTitle>
        <CardDescription>
          Enviamos um email com o link de confirmação. Abra a mensagem para
          ativar sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-3" onSubmit={handleResend} noValidate>
          <div className="space-y-2">
            <Label htmlFor="resend-email">Não recebeu? Reenviar para</Label>
            <Input
              id="resend-email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={status.state === "sending"}
          >
            {status.state === "sending"
              ? "Reenviando…"
              : "Reenviar email de verificação"}
          </Button>
          {status.state === "sent" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Reenviado. Confira sua caixa de entrada e a pasta de spam.
            </p>
          ) : null}
          {status.state === "error" ? (
            <p role="alert" className="text-destructive text-sm font-medium">
              {status.message}
            </p>
          ) : null}
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Já confirmou?{" "}
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
