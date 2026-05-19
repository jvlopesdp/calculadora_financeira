import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  OUTSTANDING_BALANCE_CHART_EMPTY_STATE,
  prepareOutstandingBalanceData,
  type OutstandingBalanceChartPoint,
} from "@/features/simulator/components/charts/outstanding-balance-chart-data";

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  payload?: OutstandingBalanceChartPoint;
  name?: string;
  color?: string;
}

interface TooltipContentProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipPayloadEntry[];
}

export function OutstandingBalanceTooltipContent({
  active,
  label,
  payload,
}: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const monthValue =
    typeof label === "number"
      ? label
      : typeof point.month === "number"
        ? point.month
        : 0;
  return (
    <div
      data-testid="outstanding-balance-tooltip"
      className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-xs shadow-md"
    >
      <p className="text-muted-foreground mb-1 font-medium">
        Mês {monthValue} · {formatMonths(monthValue)}
      </p>
      <dl className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <dt>Saldo base</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.saldoBase)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Saldo com extra</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.saldoExtra)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Diferença</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.diferenca)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function formatBRLAxisTick(value: number): string {
  return formatBRL(value);
}

function formatMonthAxisTick(value: number): string {
  return String(value);
}

export function OutstandingBalanceChart() {
  const { financing, extraMonthly, extraStrategy } = useSimulation();
  const data = useMemo(
    () => prepareOutstandingBalanceData(financing, extraMonthly, extraStrategy),
    [financing, extraMonthly, extraStrategy],
  );

  if (!data || data.length === 0) {
    return (
      <p
        data-testid="outstanding-balance-chart-empty-state"
        className="text-muted-foreground text-sm"
      >
        {OUTSTANDING_BALANCE_CHART_EMPTY_STATE}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 className="font-serif text-lg font-semibold">
          Saldo devedor ao longo do tempo
        </h4>
        <p className="text-muted-foreground text-xs">
          Comparação entre o saldo base e o saldo com pagamento extra (
          {extraStrategy === "term" ? "reduzir prazo" : "reduzir parcela"}).
        </p>
      </div>
      <div
        data-testid="outstanding-balance-chart"
        data-point-count={data.length}
        data-strategy={extraStrategy}
        className="h-72 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthAxisTick}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={formatBRLAxisTick}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 12 }}
              width={108}
            />
            <Tooltip content={<OutstandingBalanceTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="saldoBase"
              name="Saldo base"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="saldoExtra"
              name="Saldo com extra"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
