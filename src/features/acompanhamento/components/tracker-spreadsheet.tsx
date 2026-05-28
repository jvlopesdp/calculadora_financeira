import { useId, useMemo } from "react";
import Decimal from "decimal.js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import type { TrackerCurves } from "@/features/acompanhamento/lib/build-curves";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";
import { formatBRL } from "@/lib/formatters/currency";
import { formatInteger } from "@/lib/formatters/number";

const APPLY_MODE_LABEL: Record<TrackerEntryApi["apply_mode"], string> = {
  reduce_term: "Reduzir prazo",
  reduce_installment: "Reduzir parcela",
};

interface SpreadsheetRow {
  monthIndex: number;
  dueDate: string;
  scheduledInstallment: Decimal;
  paid: Decimal | null;
  applyMode: TrackerEntryApi["apply_mode"] | null;
  /** Realized balance after the month; null once the plan is settled. */
  balanceAfter: Decimal | null;
  settled: boolean;
  note: string | null;
}

/** Adds `monthsToAdd` to a "YYYY-MM-DD" date and formats as "DD/MM/YYYY". */
function addMonthsToIso(startIso: string, monthsToAdd: number): string {
  const parts = startIso.split("-");
  if (parts.length !== 3) return startIso;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return startIso;
  }
  const zeroBased = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(targetDay)}/${pad(targetMonth)}/${targetYear}`;
}

interface TrackerSpreadsheetProps {
  plan: TrackerPlanApi;
  entries: TrackerEntryApi[];
  curves: TrackerCurves;
}

/**
 * Planilha mês a mês (somente leitura) do plano: parcela prevista (Normal),
 * lançamentos reais (Pago/Modo/Nota) e saldo devedor após cada mês (Realizado).
 * Linhas após a quitação antecipada aparecem como "Quitado" com saldo 0. A
 * edição inline chega na US-019 — aqui as colunas são apenas leitura.
 */
export function TrackerSpreadsheet({
  plan,
  entries,
  curves,
}: TrackerSpreadsheetProps) {
  const sectionTitleId = useId();

  const rows = useMemo<SpreadsheetRow[]>(() => {
    const entryByMonth = new Map<number, TrackerEntryApi>();
    for (const entry of entries) {
      entryByMonth.set(entry.month_index, entry);
    }
    const realizedMonths = curves.realized.months;

    const result: SpreadsheetRow[] = [];
    for (let month = 1; month <= plan.term_months; month++) {
      const normalRow = curves.normal[month - 1];
      const realizedRow = realizedMonths[month - 1];
      const settled = realizedRow === undefined;
      const entry = entryByMonth.get(month) ?? null;
      result.push({
        monthIndex: month,
        dueDate: addMonthsToIso(plan.start_date, month - 1),
        scheduledInstallment: normalRow?.installment ?? new Decimal(0),
        paid: entry ? new Decimal(entry.paid_amount_cents).div(100) : null,
        applyMode: entry?.apply_mode ?? null,
        balanceAfter: settled ? null : realizedRow.balance,
        settled,
        note: entry?.note ?? null,
      });
    }
    return result;
  }, [plan, entries, curves]);

  const columns = useMemo<DataTableColumn<SpreadsheetRow>[]>(
    () => [
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
        sortable: true,
        sortValue: (r) => (r.paid ? r.paid.toNumber() : -1),
        cell: (r) => (r.paid ? formatBRL(r.paid) : "—"),
      },
      {
        id: "mode",
        header: "Modo",
        cell: (r) => (r.applyMode ? APPLY_MODE_LABEL[r.applyMode] : "—"),
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
        cell: (r) => r.note ?? "—",
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle id={sectionTitleId}>Planilha mês a mês</CardTitle>
        <CardDescription>
          Parcela prevista (sem antecipação), lançamentos registrados e saldo
          devedor após cada mês. A edição dos lançamentos chega em breve.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          pageSize={24}
          ariaLabelledBy={sectionTitleId}
        />
      </CardContent>
    </Card>
  );
}
