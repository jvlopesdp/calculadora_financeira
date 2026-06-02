import { useState } from "react";

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
import { ApiError, type PaymentApi } from "@/lib/api-client";
import { formatBRL } from "@/lib/formatters/currency";
import { useDeletePayment } from "@/lib/queries/payments";

export interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string;
  payment: PaymentApi | null;
  onDeleted: (payment: PaymentApi) => void;
}

export function DeletePaymentDialog({
  open,
  onOpenChange,
  scenarioId,
  payment,
  onDeleted,
}: DeletePaymentDialogProps) {
  const deleteMutation = useDeletePayment();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitting = deleteMutation.isPending;

  async function handleConfirm() {
    if (!payment) return;
    setErrorMessage(null);
    try {
      const deleted = await deleteMutation.mutateAsync({
        scenarioId,
        paymentId: payment.id,
      });
      onDeleted(deleted);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorMessage("Pagamento não encontrado.");
      } else if (err instanceof ApiError && err.status === 401) {
        setErrorMessage(
          "Sessão expirada. Recarregue a página e entre novamente.",
        );
      } else {
        const message = err instanceof Error ? err.message : "";
        setErrorMessage(
          message.length > 0
            ? message
            : "Erro ao excluir pagamento. Tente novamente.",
        );
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir pagamento</DialogTitle>
          <DialogDescription>
            {payment
              ? `Tem certeza que deseja excluir o pagamento de ${formatBRL(payment.amount_paid_cents / 100)} referente a ${payment.reference_month}? Esta ação não pode ser desfeita.`
              : "Tem certeza que deseja excluir este pagamento?"}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
