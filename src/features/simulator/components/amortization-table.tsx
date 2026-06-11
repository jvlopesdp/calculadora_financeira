import { useId, useMemo, useState } from "react";
import Decimal from "decimal.js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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
  index: number;
  month: number;
  installment: Decimal;
  interest: Decimal;
  amortization: Decimal;
  balance: Decimal;
  extraPayment: Decimal;
}

const ZERO = new Decimal(0);
const EMPTY_STATE = "Preencha os dados para simular";

const SCENARIO_OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "extra-term", label: "Com extra (reduzir prazo)" },
  { value: "extra-installment", label: "Com extra (reduzir parcela)" },
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

function fromBaseSchedule(schedule: ScheduleRow[]): TableRow[] {
  return schedule.map((row, idx) => ({
    index: idx + 1,
    month: row.month,
    installment: row.installment,
    interest: row.interest,
    amortization: row.amortization,
    balance: row.balance,
    extraPayment: ZERO,
  }));
}

function fromPrepaymentSchedule(schedule: PrepaymentScheduleRow[]): TableRow[] {
  return schedule.map((row, idx) => ({
    index: idx + 1,
    month: row.month,
    installment: row.installment,
    interest: row.interest,
    amortization: row.amortization,
    balance: row.balance,
    extraPayment: row.extraPayment,
  }));
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
    return fromBaseSchedule(schedule);
  }

  const extra = new Decimal(extraMonthly ?? 0);
  const result =
    scenario === "extra-term"
      ? applyPrepaymentReduceTerm(inputs, extra)
      : applyPrepaymentReduceInstallment(inputs, extra);
  return fromPrepaymentSchedule(result.schedule);
}

export function AmortizationTable() {
  const { financing, extraMonthly } = useSimulation();
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const sectionTitleId = useId();
  const scenarioId = useId();

  const rows = useMemo<TableRow[] | null>(() => {
    if (!financing) return null;
    try {
      const inputs = buildFinancingInputs(financing);
      return rowsForScenario(inputs, scenario, extraMonthly);
    } catch {
      return null;
    }
  }, [financing, scenario, extraMonthly]);

  const hasExtras = useMemo(
    () => (rows ?? []).some((r) => r.extraPayment.greaterThan(0)),
    [rows],
  );

  const columns = useMemo<DataTableColumn<TableRow>[]>(() => {
    const base: DataTableColumn<TableRow>[] = [
      {
        id: "index",
        header: "Nº",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.index,
        cell: (r) => formatInteger(r.index),
      },
      {
        id: "month",
        header: "Mês",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.month,
        cell: (r) => formatInteger(r.month),
      },
      {
        id: "installment",
        header: "Parcela",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.installment.toNumber(),
        cell: (r) => formatBRL(r.installment),
      },
      {
        id: "interest",
        header: "Juros",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.interest.toNumber(),
        cell: (r) => formatBRL(r.interest),
      },
      {
        id: "amortization",
        header: "Amortização",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.amortization.toNumber(),
        cell: (r) => formatBRL(r.amortization),
      },
      {
        id: "balance",
        header: "Saldo devedor",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.balance.toNumber(),
        cell: (r) => formatBRL(r.balance),
      },
    ];
    if (hasExtras) {
      base.push({
        id: "extra",
        header: "Extra",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.extraPayment.toNumber(),
        cell: (r) => formatBRL(r.extraPayment),
      });
    }
    return base;
  }, [hasExtras]);

  return (
    <Card className="md:col-span-12">
      <CardHeader>
        <CardTitle id={sectionTitleId}>Tabela de amortização</CardTitle>
        <CardDescription>
          Detalhamento mês a mês das parcelas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="amortization-table-empty-state"
          >
            {EMPTY_STATE}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 md:max-w-xs">
              <Label htmlFor={scenarioId}>Cenário</Label>
              <Select
                value={scenario}
                onValueChange={(value) => setScenario(value as ScenarioId)}
              >
                <SelectTrigger id={scenarioId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DataTable
              columns={columns}
              data={rows}
              pageSize={12}
              ariaLabelledBy={sectionTitleId}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
