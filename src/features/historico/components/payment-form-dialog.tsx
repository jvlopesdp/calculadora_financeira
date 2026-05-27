import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CurrencyInput } from "@/components/finance/currency-input";
import { Button } from "@/components/ui/button";
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
import { Select } from "@/components/ui/select";
import {
  paymentSchema,
  PAYMENT_TYPES,
  AMORTIZATION_STRATEGIES,
  type PaymentFormValues,
} from "@/features/historico/schemas/payment";
import {
  ApiError,
  createPayment,
  updatePayment,
  type PaymentApi,
} from "@/lib/api-client";

type Mode = "create" | "edit";

export interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string;
  /** When provided the dialog edits this payment; otherwise creates a new one. */
  payment?: PaymentApi | null;
  /** Optional create-mode prefills (ignored when `payment` is provided). */
  initialDraft?: Partial<PaymentFormValues> | null;
  onSaved: (payment: PaymentApi) => void;
}

const TYPE_LABELS: Record<(typeof PAYMENT_TYPES)[number], string> = {
  parcela: "Parcela",
  amortizacao_extra: "Amortização extra",
  misto: "Misto",
};

const STRATEGY_LABELS: Record<(typeof AMORTIZATION_STRATEGIES)[number], string> =
  {
    prazo: "Reduzir prazo",
    parcela: "Reduzir parcela",
  };

function defaultValues(
  payment: PaymentApi | null | undefined,
  draft?: Partial<PaymentFormValues> | null,
): PaymentFormValues {
  if (payment) {
    return {
      referenceMonth: payment.reference_month,
      paymentDate: payment.payment_date,
      amountPaid: payment.amount_paid_cents / 100,
      paymentType:
        (PAYMENT_TYPES as readonly string[]).includes(payment.payment_type)
          ? (payment.payment_type as (typeof PAYMENT_TYPES)[number])
          : "parcela",
      amortizationStrategy: (AMORTIZATION_STRATEGIES as readonly string[]).includes(
        payment.amortization_strategy,
      )
        ? (payment.amortization_strategy as (typeof AMORTIZATION_STRATEGIES)[number])
        : "prazo",
      notes: payment.notes ?? "",
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  const base: PaymentFormValues = {
    referenceMonth: today.slice(0, 7),
    paymentDate: today,
    amountPaid: 0,
    paymentType: "parcela",
    amortizationStrategy: "prazo",
    notes: "",
  };
  return draft ? { ...base, ...draft } : base;
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  scenarioId,
  payment,
  initialDraft,
  onSaved,
}: PaymentFormDialogProps) {
  const mode: Mode = payment ? "edit" : "create";
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onBlur",
    defaultValues: defaultValues(payment, initialDraft),
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues(payment, initialDraft));
      setFormError(null);
    }
  }, [open, payment, initialDraft, form]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setFormError(null);
      }
    },
    [onOpenChange],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const trimmedNotes = (values.notes ?? "").trim();
      const payloadBase = {
        referenceMonth: values.referenceMonth,
        paymentDate: values.paymentDate,
        amountPaid: values.amountPaid,
        paymentType: values.paymentType,
        amortizationStrategy: values.amortizationStrategy,
      };
      const saved =
        mode === "create"
          ? await createPayment(scenarioId, {
              ...payloadBase,
              ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
            })
          : await updatePayment(scenarioId, payment!.id, {
              ...payloadBase,
              notes: trimmedNotes.length > 0 ? trimmedNotes : null,
            });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFormError(
          "Não foi possível salvar o pagamento. Verifique os campos e tente novamente.",
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError("Sessão expirada. Recarregue a página e entre novamente.");
      } else if (err instanceof ApiError && err.status === 404) {
        setFormError("Pagamento ou cenário não encontrado.");
      } else {
        const message = err instanceof Error ? err.message : "";
        setFormError(
          message.length > 0
            ? message
            : "Erro de rede. Verifique sua conexão e tente novamente.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Registrar pagamento" : "Editar pagamento"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Informe os dados do pagamento realizado."
              : "Atualize os dados do pagamento."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={onSubmit}
            noValidate
            aria-label={
              mode === "create" ? "Registrar pagamento" : "Editar pagamento"
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="referenceMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês de referência</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do pagamento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Valor pago</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de pagamento</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        {PAYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amortizationStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estratégia</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        {AMORTIZATION_STRATEGIES.map((s) => (
                          <option key={s} value={s}>
                            {STRATEGY_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Observações sobre o pagamento"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {formError ? (
              <p
                role="alert"
                className="text-destructive text-sm font-medium"
              >
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Salvando…"
                  : mode === "create"
                    ? "Registrar pagamento"
                    : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
