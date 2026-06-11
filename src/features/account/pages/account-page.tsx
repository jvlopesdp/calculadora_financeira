import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/features/account/schemas/change-password";
import {
  deleteAccountSchema,
  type DeleteAccountFormValues,
} from "@/features/account/schemas/delete-account";
import { ApiError } from "@/lib/api-client";
import {
  useAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "@/lib/queries/account";
import { authClient } from "@/lib/auth-client";

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

type ChangePasswordErrorBody = {
  code?: string;
  message?: string;
  status?: number;
};

function translateChangePasswordError(
  error: ChangePasswordErrorBody | null | undefined,
): string {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "INVALID_PASSWORD") {
    return "A senha atual está incorreta.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "A nova senha deve ter pelo menos 8 caracteres.";
  }
  if (code === "PASSWORD_TOO_LONG") {
    return "A nova senha é muito longa.";
  }
  if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
    return "Esta conta não usa senha. Use o provedor com o qual entrou.";
  }
  if (error?.status === 429) {
    return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
  }
  if (typeof error?.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "Não foi possível trocar a senha. Tente novamente.";
}

function translateDeleteError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = (error.body ?? {}) as ApiErrorBody;
    const code = typeof body.error === "string" ? body.error : "";
    if (code === "INVALID_PASSWORD") {
      return "Senha incorreta. Verifique e tente novamente.";
    }
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
      return "Esta conta não usa senha. Use o provedor com o qual entrou para confirmar.";
    }
    if (error.status === 429) {
      return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Não foi possível excluir a conta. Tente novamente.";
}

export function AccountPage() {
  const navigate = useNavigate();
  const accountQuery = useAccount();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

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

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  const [passwordFeedback, setPasswordFeedback] = useState<
    { kind: "success"; message: string } | { kind: "error"; message: string } | null
  >(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const deleteForm = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    mode: "onBlur",
    defaultValues: { password: "" },
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteSubmitting = deleteMutation.isPending;

  function openDeleteDialog() {
    deleteForm.reset({ password: "" });
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && deleteSubmitting) return;
    setDeleteOpen(open);
    if (!open) {
      setDeleteError(null);
      deleteForm.reset({ password: "" });
    }
  }

  const onDeleteSubmit = deleteForm.handleSubmit(async (values) => {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync({ password: values.password });
      setDeleteOpen(false);
      deleteForm.reset({ password: "" });
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteError(translateDeleteError(err));
    }
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordFeedback(null);
    setPasswordSubmitting(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordFeedback({
          kind: "error",
          message: translateChangePasswordError(
            result.error as ChangePasswordErrorBody,
          ),
        });
        return;
      }
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        newPasswordConfirmation: "",
      });
      setPasswordFeedback({
        kind: "success",
        message:
          "Senha trocada com sucesso. As demais sessões foram desconectadas.",
      });
    } catch (err) {
      setPasswordFeedback({
        kind: "error",
        message:
          err instanceof Error && err.message.length > 0
            ? err.message
            : "Erro de rede. Verifique sua conexão e tente novamente.",
      });
    } finally {
      setPasswordSubmitting(false);
    }
  });

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

      <Card data-testid="change-password-card">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>
            Use sua senha atual para definir uma nova. As outras sessões serão
            desconectadas após a troca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              className="space-y-4"
              onSubmit={onPasswordSubmit}
              noValidate
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha atual</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Sua senha atual"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
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
                control={passwordForm.control}
                name="newPasswordConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirme a nova senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Digite a nova senha novamente"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {passwordFeedback?.kind === "success" ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm text-emerald-600 dark:text-emerald-400"
                  data-testid="change-password-success"
                >
                  {passwordFeedback.message}
                </p>
              ) : null}

              {passwordFeedback?.kind === "error" ? (
                <p
                  role="alert"
                  className="text-destructive text-sm font-medium"
                  data-testid="change-password-error"
                >
                  {passwordFeedback.message}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={passwordSubmitting}
                aria-disabled={passwordSubmitting}
              >
                {passwordSubmitting ? "Salvando…" : "Trocar senha"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card
        className="border-destructive/40"
        data-testid="delete-account-card"
      >
        <CardHeader>
          <CardTitle>Excluir conta</CardTitle>
          <CardDescription>
            Esta ação é permanente: sua conta e todos os seus dados
            (financiamentos, lançamentos e sessões) serão removidos
            definitivamente. Não há como desfazer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={openDeleteDialog}
            data-testid="delete-account-trigger"
          >
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
        <DialogContent data-testid="delete-account-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão de conta</DialogTitle>
            <DialogDescription>
              Para confirmar, digite sua senha atual. Sua conta e todos os
              dados associados serão excluídos imediatamente e não poderão ser
              recuperados.
            </DialogDescription>
          </DialogHeader>
          <Form {...deleteForm}>
            <form
              className="space-y-4"
              onSubmit={onDeleteSubmit}
              noValidate
            >
              <FormField
                control={deleteForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha atual</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Sua senha atual"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {deleteError ? (
                <p
                  role="alert"
                  className="text-destructive text-sm font-medium"
                  data-testid="delete-account-error"
                >
                  {deleteError}
                </p>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleteSubmitting}
                  >
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deleteSubmitting}
                  aria-disabled={deleteSubmitting}
                  data-testid="delete-account-confirm"
                >
                  {deleteSubmitting ? "Excluindo…" : "Excluir minha conta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
