import { useId, useMemo, useState } from "react";
import Decimal from "decimal.js";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import type { TrackerCurves } from "@/features/acompanhamento/lib/build-curves";
import { dueDateBR, dueDateIso } from "@/features/acompanhamento/lib/due-date";
import {
  ApiError,
  type TrackerEntryApi,
  type TrackerPlanApi,
} from "@/lib/api-client";
import {
  useDeleteTrackerEntry,
  useUpsertTrackerEntry,
} from "@/lib/queries/tracker-plans";
import { formatBRL } from "@/lib/formatters/currency";
import { formatInteger } from "@/lib/formatters/number";

type ApplyMode = TrackerEntryApi["apply_mode"];

const APPLY_MODE_LABEL: Record<ApplyMode, string> = {
  reduce_term: "Reduzir prazo",
  reduce_installment: "Reduzir parcela",
};

interface RowDraft {
  paid: number | null;
  applyMode: ApplyMode;
}

interface SpreadsheetRow {
  monthIndex: number;
  /** "DD/MM/YYYY" for display. */
  dueDate: string;
  /** "YYYY-MM-DD" — the default `paid_at` when a month is first paid. */
  dueIso: string;
  scheduledInstallment: Decimal;
  entry: TrackerEntryApi | null;
  /** Realized balance after the month; null once the plan is settled. */
  balanceAfter: Decimal | null;
  settled: boolean;
}

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
    if (err.status === 404) return "Plano ou lançamento não encontrado.";
    if (err.status === 422) {
      return "Não foi possível salvar o lançamento. Verifique os valores.";
    }
  }
  return err instanceof Error && err.message.length > 0
    ? err.message
    : "Erro ao salvar o lançamento. Tente novamente.";
}

interface TrackerSpreadsheetProps {
  plan: TrackerPlanApi;
  entries: TrackerEntryApi[];
  curves: TrackerCurves;
}

/**
 * Planilha mês a mês editável do plano: parcela prevista (Normal), o lançamento
 * real (Pago/Modo, editáveis inline) e o saldo devedor após cada mês
 * (Realizado, recalculado a cada edição). Linhas após a quitação antecipada
 * aparecem como "Quitado" com os inputs bloqueados. Salvar/excluir usam
 * mutations otimistas (`useUpsertTrackerEntry`/`useDeleteTrackerEntry`) que
 * revertem o cache em caso de erro.
 */
export function TrackerSpreadsheet({
  plan,
  entries,
  curves,
}: TrackerSpreadsheetProps) {
  const sectionTitleId = useId();
  const upsert = useUpsertTrackerEntry(plan.id);
  const remove = useDeleteTrackerEntry(plan.id);

  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    entryId: string;
    monthIndex: number;
  } | null>(null);

  const entryByMonth = useMemo(() => {
    const map = new Map<number, TrackerEntryApi>();
    for (const entry of entries) map.set(entry.month_index, entry);
    return map;
  }, [entries]);

  const rows = useMemo<SpreadsheetRow[]>(() => {
    const realizedMonths = curves.realized.months;
    const result: SpreadsheetRow[] = [];
    for (let month = 1; month <= plan.term_months; month++) {
      const normalRow = curves.normal[month - 1];
      const realizedRow = realizedMonths[month - 1];
      const settled = realizedRow === undefined;
      // "Parcela prevista" reflete a parcela vigente do mês — após um
      // lançamento `reduce_installment`, todas as parcelas seguintes têm
      // `scheduledInstallment` recalculado pelo engine (US-012). Meses já
      // quitados pela antecipação caem no cronograma original.
      const scheduledInstallment = settled
        ? (normalRow?.installment ?? new Decimal(0))
        : realizedRow.scheduledInstallment;
      result.push({
        monthIndex: month,
        dueDate: dueDateBR(plan.start_date, month - 1),
        dueIso: dueDateIso(plan.start_date, month - 1),
        scheduledInstallment,
        entry: entryByMonth.get(month) ?? null,
        balanceAfter: settled ? null : realizedRow.balance,
        settled,
      });
    }
    return result;
  }, [plan, entryByMonth, curves]);

  function paidValue(row: SpreadsheetRow): number | null {
    const draft = drafts[row.monthIndex];
    if (draft) return draft.paid;
    return row.entry ? row.entry.paid_amount_cents / 100 : null;
  }

  function modeValue(row: SpreadsheetRow): ApplyMode {
    const draft = drafts[row.monthIndex];
    if (draft) return draft.applyMode;
    return row.entry?.apply_mode ?? "reduce_term";
  }

  function clearRowError(monthIndex: number) {
    setRowErrors((prev) => {
      if (prev[monthIndex] === undefined) return prev;
      const next = { ...prev };
      delete next[monthIndex];
      return next;
    });
  }

  function handlePaidChange(row: SpreadsheetRow, value: number | null) {
    clearRowError(row.monthIndex);
    setDrafts((prev) => ({
      ...prev,
      [row.monthIndex]: { paid: value, applyMode: modeValue(row) },
    }));
  }

  function handleModeChange(row: SpreadsheetRow, mode: ApplyMode) {
    setDrafts((prev) => ({
      ...prev,
      [row.monthIndex]: { paid: paidValue(row), applyMode: mode },
    }));
  }

  function clearDraft(monthIndex: number) {
    setDrafts((prev) => {
      if (prev[monthIndex] === undefined) return prev;
      const next = { ...prev };
      delete next[monthIndex];
      return next;
    });
  }

  async function handleSave(row: SpreadsheetRow) {
    const paid = paidValue(row);
    const mode = modeValue(row);
    if (paid === null) {
      setRowErrors((prev) => ({
        ...prev,
        [row.monthIndex]: "Informe o valor pago.",
      }));
      return;
    }
    const minCents = Math.round(row.scheduledInstallment.toNumber() * 100);
    if (Math.round(paid * 100) < minCents) {
      setRowErrors((prev) => ({
        ...prev,
        [row.monthIndex]: `O valor pago não pode ser menor que a parcela prevista (${formatBRL(row.scheduledInstallment)}).`,
      }));
      return;
    }
    clearRowError(row.monthIndex);
    setActionError(null);
    try {
      await upsert.mutateAsync({
        month_index: row.monthIndex,
        paid_amount: paid,
        paid_at: row.entry?.paid_at ?? row.dueIso,
        apply_mode: mode,
        note: row.entry?.note ?? undefined,
      });
      clearDraft(row.monthIndex);
    } catch (err) {
      setActionError(messageFromError(err));
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { entryId, monthIndex } = pendingDelete;
    setActionError(null);
    try {
      await remove.mutateAsync(entryId);
      clearDraft(monthIndex);
      setPendingDelete(null);
    } catch (err) {
      setActionError(messageFromError(err));
      setPendingDelete(null);
    }
  }

  const columns: DataTableColumn<SpreadsheetRow>[] = [
    {
      id: "month",
      header: "Mês",
      numeric: true,
      sortable: true,
      sortValue: (r) => r.monthIndex,
      cell: (r) => formatInteger(r.monthIndex),
    },
    {
      id: "dueDate",
      header: "Vencimento",
      cell: (r) => r.dueDate,
    },
    {
      id: "installment",
      header: "Parcela prevista",
      numeric: true,
      sortable: true,
      sortValue: (r) => r.scheduledInstallment.toNumber(),
      cell: (r) => formatBRL(r.scheduledInstallment),
    },
    {
      id: "paid",
      header: "Pago",
      numeric: true,
      cell: (r) => (
        <div className="flex flex-col items-end gap-1">
          <CurrencyInput
            aria-label={`Valor pago no mês ${r.monthIndex}`}
            className="w-32 text-right"
            value={paidValue(r)}
            min={r.scheduledInstallment.toNumber()}
            disabled={r.settled || upsert.isPending}
            onChange={(value) => handlePaidChange(r, value)}
          />
          {rowErrors[r.monthIndex] ? (
            <span role="alert" className="text-destructive text-xs">
              {rowErrors[r.monthIndex]}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "mode",
      header: "Modo",
      cell: (r) => (
        <Select
          value={modeValue(r)}
          disabled={r.settled || upsert.isPending}
          onValueChange={(value) => handleModeChange(r, value as ApplyMode)}
        >
          <SelectTrigger
            aria-label={`Modo do mês ${r.monthIndex}`}
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reduce_term">
              {APPLY_MODE_LABEL.reduce_term}
            </SelectItem>
            <SelectItem value="reduce_installment">
              {APPLY_MODE_LABEL.reduce_installment}
            </SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "balance",
      header: "Saldo após",
      numeric: true,
      sortable: true,
      sortValue: (r) => (r.settled ? 0 : (r.balanceAfter?.toNumber() ?? 0)),
      cell: (r) =>
        r.settled ? (
          <span className="text-muted-foreground">Quitado</span>
        ) : (
          formatBRL(r.balanceAfter ?? new Decimal(0))
        ),
    },
    {
      id: "note",
      header: "Nota",
      cell: (r) => r.entry?.note ?? "—",
    },
    {
      id: "actions",
      header: "Ações",
      cell: (r) => {
        if (r.settled) return null;
        const entry = r.entry;
        return (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={drafts[r.monthIndex] === undefined || upsert.isPending}
              onClick={() => void handleSave(r)}
            >
              Salvar
            </Button>
            {entry ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={remove.isPending}
                aria-label={`Excluir lançamento do mês ${r.monthIndex}`}
                onClick={() =>
                  setPendingDelete({
                    entryId: entry.id,
                    monthIndex: r.monthIndex,
                  })
                }
              >
                Excluir
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle id={sectionTitleId}>Planilha mês a mês</CardTitle>
        <CardDescription>
          Edite o valor pago e o modo de cada mês. O saldo devedor é recalculado
          na hora; lançamentos abaixo da parcela prevista são bloqueados.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {actionError ? (
          <p
            role="alert"
            aria-live="polite"
            className="text-destructive text-sm font-medium"
            data-testid="tracker-spreadsheet-error"
          >
            {actionError}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          data={rows}
          pageSize={24}
          ariaLabelledBy={sectionTitleId}
        />
      </CardContent>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `Tem certeza que deseja excluir o lançamento do mês ${pendingDelete.monthIndex}? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja excluir este lançamento?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {remove.isPending ? "Excluindo…" : "Excluir lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
