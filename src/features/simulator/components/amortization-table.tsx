import { useEffect, useId, useMemo, useState } from "react";
import Decimal from "decimal.js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/currency";
import { formatInteger } from "@/lib/formatters/number";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  type FinancingInputs,
  type ScheduleRow,
} from "@/core/finance/financial-types";
import {
  applyPrepaymentReduceInstallment,
  applyPrepaymentReduceTerm,
  type PrepaymentScheduleRow,
} from "@/core/finance/prepayment";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

type ScenarioId = "base" | "extra-term" | "extra-installment";

interface TableRow {
  month: number;
  baseInstallment: Decimal;
  interest: Decimal;
  amortization: Decimal;
  extraPayment: Decimal;
  installment: Decimal;
  balance: Decimal;
  cumulativeInterest: Decimal;
  cumulativeAmortization: Decimal;
  status: "Em andamento" | "Última parcela";
}

const ZERO = new Decimal(0);
const EMPTY_STATE = "Preencha os dados para simular";
const ROWS_PER_PAGE = 12;

const SCENARIO_OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "extra-term", label: "Com extra (reduzir prazo)" },
  { value: "extra-installment", label: "Com extra (reduzir parcela)" },
];

type ColumnId =
  | "month"
  | "baseInstallment"
  | "interest"
  | "amortization"
  | "extraPayment"
  | "installment"
  | "balance"
  | "cumulativeInterest"
  | "cumulativeAmortization"
  | "status";

interface ColumnDef {
  id: ColumnId;
  label: string;
  numeric: boolean;
  sortable: boolean;
  render: (row: TableRow) => string;
  sortValue?: (row: TableRow) => number;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "month",
    label: "Mês",
    numeric: true,
    sortable: true,
    render: (row) => formatInteger(row.month),
    sortValue: (row) => row.month,
  },
  {
    id: "baseInstallment",
    label: "Parcela base",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.baseInstallment),
    sortValue: (row) => row.baseInstallment.toNumber(),
  },
  {
    id: "interest",
    label: "Juros",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.interest),
    sortValue: (row) => row.interest.toNumber(),
  },
  {
    id: "amortization",
    label: "Amortização",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.amortization),
    sortValue: (row) => row.amortization.toNumber(),
  },
  {
    id: "extraPayment",
    label: "Pagamento extra",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.extraPayment),
    sortValue: (row) => row.extraPayment.toNumber(),
  },
  {
    id: "installment",
    label: "Pagamento total",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.installment),
    sortValue: (row) => row.installment.toNumber(),
  },
  {
    id: "balance",
    label: "Saldo devedor",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.balance),
    sortValue: (row) => row.balance.toNumber(),
  },
  {
    id: "cumulativeInterest",
    label: "Juros acumulados",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.cumulativeInterest),
    sortValue: (row) => row.cumulativeInterest.toNumber(),
  },
  {
    id: "cumulativeAmortization",
    label: "Amortização acumulada",
    numeric: true,
    sortable: true,
    render: (row) => formatBRL(row.cumulativeAmortization),
    sortValue: (row) => row.cumulativeAmortization.toNumber(),
  },
  {
    id: "status",
    label: "Status",
    numeric: false,
    sortable: false,
    render: (row) => row.status,
  },
];

function buildFinancingInputs(values: FinancingFormValues): FinancingInputs {
  const principal = new Decimal(values.propertyValue).minus(values.downPayment);
  const monthlyRate = new Decimal(values.monthlyRate).div(100);
  return {
    principal,
    monthlyRate,
    termMonths: values.termMonths,
    system: values.system,
  };
}

function decorateBase(schedule: ScheduleRow[]): TableRow[] {
  let cumInterest = ZERO;
  let cumAmortization = ZERO;
  const last = schedule.length - 1;
  return schedule.map((row, idx) => {
    cumInterest = cumInterest.plus(row.interest);
    cumAmortization = cumAmortization.plus(row.amortization);
    return {
      month: row.month,
      baseInstallment: row.installment,
      interest: row.interest,
      amortization: row.amortization,
      extraPayment: ZERO,
      installment: row.installment,
      balance: row.balance,
      cumulativeInterest: cumInterest,
      cumulativeAmortization: cumAmortization,
      status: idx === last ? "Última parcela" : "Em andamento",
    };
  });
}

function decoratePrepayment(schedule: PrepaymentScheduleRow[]): TableRow[] {
  let cumInterest = ZERO;
  let cumAmortization = ZERO;
  const last = schedule.length - 1;
  return schedule.map((row, idx) => {
    cumInterest = cumInterest.plus(row.interest);
    cumAmortization = cumAmortization.plus(row.amortization);
    return {
      month: row.month,
      baseInstallment: row.baseInstallment,
      interest: row.interest,
      amortization: row.amortization,
      extraPayment: row.extraPayment,
      installment: row.installment,
      balance: row.balance,
      cumulativeInterest: cumInterest,
      cumulativeAmortization: cumAmortization,
      status: idx === last ? "Última parcela" : "Em andamento",
    };
  });
}

function rowsForScenario(
  inputs: FinancingInputs,
  scenario: ScenarioId,
  extraMonthly: number | null,
): TableRow[] {
  if (scenario === "base") {
    const schedule =
      inputs.system === "SAC"
        ? generateSacSchedule(inputs)
        : generatePriceSchedule(inputs);
    return decorateBase(schedule);
  }

  const extra = new Decimal(extraMonthly ?? 0);
  const result =
    scenario === "extra-term"
      ? applyPrepaymentReduceTerm(inputs, extra)
      : applyPrepaymentReduceInstallment(inputs, extra);
  return decoratePrepayment(result.schedule);
}

interface SortState {
  columnId: ColumnId;
  direction: "asc" | "desc";
}

interface MonthFilter {
  from: string;
  to: string;
}

const DEFAULT_FILTER: MonthFilter = { from: "", to: "" };

export function AmortizationTable() {
  const { financing, extraMonthly } = useSimulation();
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState | null>(null);
  const [filter, setFilter] = useState<MonthFilter>(DEFAULT_FILTER);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnId>>(
    () => new Set(),
  );

  const sectionTitleId = useId();
  const filterFromId = useId();
  const filterToId = useId();
  const scenarioId = useId();

  const allRows = useMemo<TableRow[] | null>(() => {
    if (!financing) return null;
    try {
      const inputs = buildFinancingInputs(financing);
      return rowsForScenario(inputs, scenario, extraMonthly);
    } catch {
      return null;
    }
  }, [financing, scenario, extraMonthly]);

  useEffect(() => {
    setPage(0);
  }, [scenario, filter.from, filter.to, allRows]);

  const fromMonth = filter.from === "" ? null : Number.parseInt(filter.from, 10);
  const toMonth = filter.to === "" ? null : Number.parseInt(filter.to, 10);
  const filteredRows = useMemo<TableRow[]>(() => {
    if (!allRows) return [];
    return allRows.filter((row) => {
      if (fromMonth !== null && Number.isFinite(fromMonth)) {
        if (row.month < fromMonth) return false;
      }
      if (toMonth !== null && Number.isFinite(toMonth)) {
        if (row.month > toMonth) return false;
      }
      return true;
    });
  }, [allRows, fromMonth, toMonth]);

  const sortedRows = useMemo<TableRow[]>(() => {
    if (!sort) return filteredRows;
    const col = COLUMNS.find((c) => c.id === sort.columnId);
    if (!col || !col.sortValue) return filteredRows;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) => (col.sortValue!(a) - col.sortValue!(b)) * dir,
    );
  }, [filteredRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(
    safePage * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  const visibleColumns = COLUMNS.filter((c) => !hiddenColumns.has(c.id));

  function toggleSort(columnId: ColumnId) {
    setSort((current) => {
      if (!current || current.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  }

  function toggleColumn(columnId: ColumnId, visible: boolean) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }

  return (
    <Card className="md:col-span-12">
      <CardHeader>
        <CardTitle id={sectionTitleId}>Tabela de amortização</CardTitle>
        <CardDescription>
          Detalhamento mês a mês das parcelas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allRows === null ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="amortization-table-empty-state"
          >
            {EMPTY_STATE}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className="border-border bg-muted/30 flex flex-col gap-3 rounded-md border p-3 md:flex-row md:flex-wrap md:items-end md:gap-4"
              data-testid="amortization-table-toolbar"
              role="toolbar"
              aria-label="Ações da tabela de amortização"
            >
              <div className="flex min-w-[220px] flex-col gap-1.5">
                <Label htmlFor={scenarioId}>Cenário</Label>
                <Select
                  id={scenarioId}
                  value={scenario}
                  onChange={(event) =>
                    setScenario(event.target.value as ScenarioId)
                  }
                >
                  {SCENARIO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={filterFromId}>Mês inicial</Label>
                  <Input
                    id={filterFromId}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    value={filter.from}
                    onChange={(event) =>
                      setFilter((prev) => ({
                        ...prev,
                        from: event.target.value,
                      }))
                    }
                    className="w-28"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={filterToId}>Mês final</Label>
                  <Input
                    id={filterToId}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    value={filter.to}
                    onChange={(event) =>
                      setFilter((prev) => ({
                        ...prev,
                        to: event.target.value,
                      }))
                    }
                    className="w-28"
                  />
                </div>
                {filter.from !== "" || filter.to !== "" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter(DEFAULT_FILTER)}
                  >
                    Limpar filtro
                  </Button>
                ) : null}
              </div>

              <details className="md:ml-auto" data-testid="column-visibility">
                <summary className="border-input bg-background hover:bg-accent inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium select-none">
                  Colunas
                </summary>
                <div className="border-border bg-popover absolute z-10 mt-1 flex flex-col gap-1 rounded-md border p-2 shadow-md">
                  {COLUMNS.map((col) => {
                    const visible = !hiddenColumns.has(col.id);
                    return (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(event) =>
                            toggleColumn(col.id, event.target.checked)
                          }
                          aria-label={`Mostrar coluna ${col.label}`}
                        />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            </div>

            <div
              className="border-border w-full overflow-x-auto rounded-md border"
              data-testid="amortization-table-scroll"
            >
              <table
                className="w-full min-w-[960px] border-collapse text-sm"
                aria-labelledby={sectionTitleId}
              >
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {visibleColumns.map((col) => {
                      const isSorted = sort?.columnId === col.id;
                      const ariaSort = !col.sortable
                        ? undefined
                        : !isSorted
                          ? "none"
                          : sort?.direction === "asc"
                            ? "ascending"
                            : "descending";
                      return (
                        <th
                          key={col.id}
                          scope="col"
                          aria-sort={ariaSort}
                          className={cn(
                            "border-border border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase",
                            col.numeric ? "text-right" : "text-left",
                          )}
                        >
                          {col.sortable ? (
                            <button
                              type="button"
                              className="hover:text-foreground inline-flex items-center gap-1 focus-visible:outline-none"
                              onClick={() => toggleSort(col.id)}
                            >
                              {col.label}
                              <span aria-hidden="true">
                                {isSorted
                                  ? sort?.direction === "asc"
                                    ? "▲"
                                    : "▼"
                                  : "↕"}
                              </span>
                            </button>
                          ) : (
                            col.label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length}
                        className="text-muted-foreground px-3 py-6 text-center text-sm"
                      >
                        Nenhuma parcela corresponde ao filtro.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr
                        key={row.month}
                        className="border-border border-b last:border-b-0"
                        data-month={row.month}
                      >
                        {visibleColumns.map((col) => (
                          <td
                            key={col.id}
                            data-column={col.id}
                            className={cn(
                              "px-3 py-2",
                              col.numeric
                                ? "font-tabular text-right"
                                : "text-left",
                            )}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-col items-center justify-between gap-2 sm:flex-row"
              data-testid="amortization-table-pagination"
            >
              <p className="text-muted-foreground text-xs">
                Página {safePage + 1} de {pageCount} ·{" "}
                {formatInteger(sortedRows.length)} parcela
                {sortedRows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
