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
import { ApiError, type TrackerPlanApi } from "@/lib/api-client";
import { useDeleteTrackerPlan } from "@/lib/queries/tracker-plans";

export interface DeleteTrackerPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: TrackerPlanApi | null;
  onDeleted: (plan: TrackerPlanApi) => void;
}

export function DeleteTrackerPlanDialog({
  open,
  onOpenChange,
  plan,
  onDeleted,
}: DeleteTrackerPlanDialogProps) {
  const deleteMutation = useDeleteTrackerPlan();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitting = deleteMutation.isPending;

  async function handleConfirm() {
    if (!plan) return;
    setErrorMessage(null);
    try {
      const deleted = await deleteMutation.mutateAsync(plan.id);
      onDeleted(deleted);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorMessage("Plano não encontrado.");
      } else if (err instanceof ApiError && err.status === 401) {
        setErrorMessage(
          "Sessão expirada. Recarregue a página e entre novamente.",
        );
      } else {
        const message = err instanceof Error ? err.message : "";
        setErrorMessage(
          message.length > 0
            ? message
            : "Erro ao excluir o plano. Tente novamente.",
        );
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir plano</DialogTitle>
          <DialogDescription>
            {plan
              ? `Tem certeza que deseja excluir o plano "${plan.name}"? Os lançamentos registrados também serão removidos. Esta ação não pode ser desfeita.`
              : "Tem certeza que deseja excluir este plano?"}
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
            {submitting ? "Excluindo…" : "Excluir plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
