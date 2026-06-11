import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  accountProfileSchema,
  type AccountProfileFormValues,
} from "@/features/account/schemas/account-profile";
import { ApiError } from "@/lib/api-client";
import { useAccount, useUpdateAccount } from "@/lib/queries/account";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface ApiErrorBody {
  error?: string;
  message?: string;
}

function translateUpdateError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = (error.body ?? {}) as ApiErrorBody;
    const code = typeof body.error === "string" ? body.error : "";
    if (code === "EMAIL_TAKEN" || code === "USER_ALREADY_EXISTS") {
      return "Este email já está em uso por outra conta.";
    }
    if (code === "validation") {
      return "Dados inválidos. Verifique os campos e tente novamente.";
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Não foi possível salvar suas alterações. Tente novamente.";
}

export function AccountPage() {
  const accountQuery = useAccount();
  const updateMutation = useUpdateAccount();

  const account = accountQuery.data;

  const form = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "" },
  });

  const { reset } = form;
  useEffect(() => {
    if (account) {
      reset({ name: account.name, email: account.email });
    }
  }, [account, reset]);

  const [feedback, setFeedback] = useState<
    | { kind: "success"; message: string }
    | { kind: "email-pending"; pendingEmail: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const createdAtLabel = useMemo(() => {
    if (!account?.createdAt) return "—";
    const date = new Date(account.createdAt);
    if (Number.isNaN(date.getTime())) return "—";
    return dateFormatter.format(date);
  }, [account?.createdAt]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!account) return;
    setFeedback(null);
    const trimmedName = values.name.trim();
    const trimmedEmail = values.email.trim().toLowerCase();
    const currentEmail = account.email.toLowerCase();

    const patch: { name?: string; email?: string } = {};
    if (trimmedName !== account.name) patch.name = trimmedName;
    if (trimmedEmail !== currentEmail) patch.email = trimmedEmail;

    if (patch.name === undefined && patch.email === undefined) {
      setFeedback({
        kind: "success",
        message: "Nenhuma alteração para salvar.",
      });
      return;
    }

    try {
      const result = await updateMutation.mutateAsync(patch);
      if (result.emailVerificationSent) {
        setFeedback({
          kind: "email-pending",
          pendingEmail: trimmedEmail,
        });
        reset({ name: result.account.name, email: result.account.email });
      } else {
        setFeedback({ kind: "success", message: "Alterações salvas." });
        reset({ name: result.account.name, email: result.account.email });
      }
    } catch (err) {
      setFeedback({ kind: "error", message: translateUpdateError(err) });
    }
  });

  const isLoading = accountQuery.isPending;
  const isError = accountQuery.isError;
  const submitting = updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6" data-testid="account-page">
      <Card>
        <CardHeader>
          <CardTitle>Minha Conta</CardTitle>
          <CardDescription>
            Visualize e atualize seus dados pessoais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              data-testid="account-loading"
              className="flex flex-col gap-3"
              role="status"
              aria-live="polite"
            >
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : isError || !account ? (
            <Alert variant="destructive" data-testid="account-error">
              <AlertTitle>Erro ao carregar</AlertTitle>
              <AlertDescription>
                Não foi possível carregar seus dados. Tente recarregar a página.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form className="space-y-6" onSubmit={onSubmit} noValidate>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">Conta criada em</p>
                  <p
                    className="font-medium"
                    data-testid="account-created-at"
                  >
                    {createdAtLabel}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="name"
                          placeholder="Como você quer ser chamado"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      <p className="text-muted-foreground text-xs">
                        Alterar o email enviará um link de confirmação. A
                        mudança só vale após confirmar.
                      </p>
                    </FormItem>
                  )}
                />

                {feedback?.kind === "success" ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-sm text-emerald-600 dark:text-emerald-400"
                    data-testid="account-success"
                  >
                    {feedback.message}
                  </p>
                ) : null}

                {feedback?.kind === "email-pending" ? (
                  <Alert data-testid="account-email-pending">
                    <AlertTitle>Confirme o novo email</AlertTitle>
                    <AlertDescription>
                      Enviamos um link de confirmação para{" "}
                      <span className="font-medium">
                        {feedback.pendingEmail}
                      </span>
                      . Sua conta continuará usando{" "}
                      <span className="font-medium">{account.email}</span> até
                      você clicar no link.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {feedback?.kind === "error" ? (
                  <p
                    role="alert"
                    className="text-destructive text-sm font-medium"
                    data-testid="account-error-message"
                  >
                    {feedback.message}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  aria-disabled={submitting}
                >
                  {submitting ? "Salvando…" : "Salvar alterações"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
