import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE,
  prepareInstallmentCompositionData,
  type InstallmentCompositionChartPoint,
} from "@/features/simulator/components/charts/installment-composition-chart-data";

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  payload?: InstallmentCompositionChartPoint;
  name?: string;
  color?: string;
}

interface TooltipContentProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipPayloadEntry[];
}

export function InstallmentCompositionTooltipContent({
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
      data-testid="installment-composition-tooltip"
      className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-xs shadow-md"
    >
      <p className="text-muted-foreground mb-1 font-medium">
        Mês {monthValue} · {formatMonths(monthValue)}
      </p>
      <dl className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <dt>Juros</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.juros)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Amortização</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.amortizacao)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Parcela total</dt>
          <dd className="font-tabular font-semibold">
            {formatBRL(point.total)}
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

export function InstallmentCompositionChart() {
  const { financing, extraMonthly, extraStrategy } = useSimulation();
  const data = useMemo(
    () => prepareInstallmentCompositionData(financing, extraMonthly, extraStrategy),
    [financing, extraMonthly, extraStrategy],
  );

  if (!data || data.length === 0) {
    return (
      <p
        data-testid="installment-composition-chart-empty-state"
        className="text-muted-foreground text-sm"
      >
        {INSTALLMENT_COMPOSITION_CHART_EMPTY_STATE}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 className="font-serif text-lg font-semibold">
          Composição das parcelas
        </h4>
        <p className="text-muted-foreground text-xs">
          Como cada parcela se divide entre juros e amortização ao longo do
          tempo.
        </p>
      </div>
      <div
        data-testid="installment-composition-chart"
        data-point-count={data.length}
        className="h-72 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
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
            <Tooltip content={<InstallmentCompositionTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="juros"
              name="Juros"
              stackId="installment"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="amortizacao"
              name="Amortização"
              stackId="installment"
              stroke="var(--chart-4)"
              fill="var(--chart-4)"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
