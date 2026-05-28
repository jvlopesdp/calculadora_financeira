import { useEffect, useId, useMemo, useState } from "react";
import Decimal from "decimal.js";

import type { ApplyMode } from "@/core/finance/tracker/realizedSchedule";
import { CurrencyInput } from "@/components/finance/currency-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { TrackerCurves } from "@/features/acompanhamento/lib/build-curves";
import { dueDateBR, dueDateIso } from "@/features/acompanhamento/lib/due-date";
import { simulateWhatIf } from "@/features/acompanhamento/lib/simulate-what-if";
import { ApiError, type TrackerPlanApi } from "@/lib/api-client";
import { formatBRL } from "@/lib/formatters/currency";
import { useUpsertTrackerEntry } from "@/lib/queries/tracker-plans";

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "Sessão expirada. Recarregue a página e entre novamente.";
    }
    const body = err.body;
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  }
  return err instanceof Error && err.message.length > 0
    ? err.message
    : "Erro ao aplicar o lançamento. Tente novamente.";
}

export interface TrackerWhatIfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: TrackerPlanApi;
  curves: TrackerCurves;
}

/**
 * Modal "Simular antecipação": testa "e se eu antecipar R$X no mês N" aplicando
 * a simulação por cima do Realizado em memória (sem chamar a API). Mostra a nova
 * data de quitação (vs Normal), os juros e parcelas economizados, e permite
 * aplicar o cenário como lançamento real via `useUpsertTrackerEntry`.
 */
export function TrackerWhatIfDialog({
  open,
  onOpenChange,
  plan,
  curves,
}: TrackerWhatIfDialogProps) {
  const monthSelectId = useId();
  const valueInputId = useId();
  const modeSelectId = useId();
  const upsert = useUpsertTrackerEntry(plan.id);

  const defaultMonth = Math.min(
    (curves.lastEntryMonth ?? 0) + 1,
    plan.term_months,
  );

  const [month, setMonth] = useState(defaultMonth);
  const [paid, setPaid] = useState<number | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyMode>("reduce_term");
  const [error, setError] = useState<string | null>(null);

  const scheduledInstallment =
    curves.normal[month - 1]?.installment ?? new Decimal(0);
  const minPaid = scheduledInstallment.toNumber();

  // Reabrir o modal recomeça com o próximo mês ainda não lançado e a parcela
  // prevista desse mês como valor mínimo sugerido.
  useEffect(() => {
    if (!open) return;
    const nextMonth = Math.min(
      (curves.lastEntryMonth ?? 0) + 1,
      plan.term_months,
    );
    setMonth(nextMonth);
    setPaid(curves.normal[nextMonth - 1]?.installment.toNumber() ?? null);
    setApplyMode("reduce_term");
    setError(null);
  }, [open, curves, plan.term_months]);

  const belowInstallment =
    paid === null || Math.round(paid * 100) < Math.round(minPaid * 100);

  const result = useMemo(() => {
    if (paid === null || belowInstallment) return null;
    return simulateWhatIf(curves, {
      month,
      paidAmount: new Decimal(paid),
      applyMode,
    });
  }, [curves, month, paid, applyMode, belowInstallment]);

  async function handleApply() {
    if (paid === null || belowInstallment) return;
    setError(null);
    try {
      await upsert.mutateAsync({
        month_index: month,
        paid_amount: paid,
        paid_at: dueDateIso(plan.start_date, month - 1),
        apply_mode: applyMode,
      });
      onOpenChange(false);
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simular antecipação</DialogTitle>
          <DialogDescription>
            Teste o impacto de um pagamento sem registrá-lo. Nada é salvo até
            você aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={monthSelectId}>Mês</Label>
              <Select
                id={monthSelectId}
                value={month}
                onChange={(event) => {
                  setMonth(Number(event.target.value));
                  setError(null);
                }}
              >
                {Array.from({ length: plan.term_months }, (_, i) => i + 1).map(
                  (m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ),
                )}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={valueInputId}>Valor</Label>
              <CurrencyInput
                id={valueInputId}
                value={paid}
                min={minPaid}
                onChange={(value) => {
                  setPaid(value);
                  setError(null);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={modeSelectId}>Modo</Label>
              <Select
                id={modeSelectId}
                value={applyMode}
                onChange={(event) =>
                  setApplyMode(event.target.value as ApplyMode)
                }
              >
                <option value="reduce_term">Reduzir prazo</option>
                <option value="reduce_installment">Reduzir parcela</option>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Parcela prevista do mês {month}: {formatBRL(scheduledInstallment)}.
          </p>

          {belowInstallment ? (
            <p
              role="alert"
              className="text-destructive text-sm font-medium"
              data-testid="tracker-what-if-below-installment"
            >
              O valor não pode ser menor que a parcela prevista (
              {formatBRL(scheduledInstallment)}).
            </p>
          ) : null}

          {result ? (
            <div
              className="bg-muted/40 grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-3"
              data-testid="tracker-what-if-result"
            >
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Nova data de quitação
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  {dueDateBR(plan.start_date, result.payoffMonth - 1)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {result.monthsSavedVsNormal > 0
                    ? `${result.monthsSavedVsNormal} ${result.monthsSavedVsNormal === 1 ? "mês" : "meses"} antes do previsto (Normal)`
                    : "No prazo Normal"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Juros economizados
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  {formatBRL(result.interestSaved)}
                </span>
                <span className="text-muted-foreground text-xs">
                  vs. trajetória atual
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Parcelas economizadas
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  {result.installmentsSaved}{" "}
                  {result.installmentsSaved === 1 ? "parcela" : "parcelas"}
                </span>
                <span className="text-muted-foreground text-xs">
                  vs. trajetória atual
                </span>
              </div>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="text-destructive text-sm font-medium"
              data-testid="tracker-what-if-error"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Descartar
          </Button>
          <Button
            type="button"
            disabled={belowInstallment || upsert.isPending}
            onClick={() => void handleApply()}
          >
            {upsert.isPending ? "Aplicando…" : "Aplicar este lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
