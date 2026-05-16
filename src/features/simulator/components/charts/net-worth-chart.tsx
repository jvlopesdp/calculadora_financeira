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
  NET_WORTH_CHART_EMPTY_STATE,
  prepareNetWorthData,
  type NetWorthChartPoint,
} from "@/features/simulator/components/charts/net-worth-chart-data";

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  payload?: NetWorthChartPoint;
  name?: string;
  color?: string;
}

interface TooltipContentProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipPayloadEntry[];
}

export function NetWorthTooltipContent({
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
      data-testid="net-worth-tooltip"
      className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-xs shadow-md"
    >
      <p className="text-muted-foreground mb-1 font-medium">
        Mês {monthValue} · {formatMonths(monthValue)}
      </p>
      <dl className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <dt>Comprar</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.comprar)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Alugar e investir</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.alugar)}
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

export function NetWorthChart() {
  const { financing, rentVsBuy } = useSimulation();
  const data = useMemo(
    () => prepareNetWorthData(financing, rentVsBuy),
    [financing, rentVsBuy],
  );

  if (!data || data.length === 0) {
    return (
      <p
        data-testid="net-worth-chart-empty-state"
        className="text-muted-foreground text-sm"
      >
        {NET_WORTH_CHART_EMPTY_STATE}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 className="font-serif text-lg font-semibold">
          Patrimônio ao longo do tempo
        </h4>
        <p className="text-muted-foreground text-xs">
          Comparação entre comprar via financiamento e alugar investindo a
          diferença.
        </p>
      </div>
      <div
        data-testid="net-worth-chart"
        data-point-count={data.length}
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
            <Tooltip content={<NetWorthTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="comprar"
              name="Comprar"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="alugar"
              name="Alugar e investir"
              stroke="var(--chart-2)"
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
