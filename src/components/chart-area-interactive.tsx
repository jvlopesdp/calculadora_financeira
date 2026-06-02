import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";
import { cn } from "@/lib/utils";

export type ChartPoint = { month: number };

export type SeriesData = {
  key: string;
  name: string;
  color: string;
  stackId?: string;
  fillOpacity?: number;
  /** Dash pattern for the line (e.g. "6 4"); solid when omitted. */
  strokeDasharray?: string;
  /** Line thickness; defaults to 2. */
  strokeWidth?: number;
};

/** A highlighted point drawn on top of the series (e.g. an early-payoff marker). */
export type ChartMarker = {
  month: number;
  value: number;
  label: string;
  color: string;
};

export type ChartView = {
  id: string;
  label: string;
  description?: string;
  kind?: "line" | "area";
  data: ChartPoint[];
  series: SeriesData[];
  markers?: ChartMarker[];
  emptyState?: string;
};

export type TimeRangeKey = "1y" | "5y" | "all";

const TIME_RANGES: Array<{ id: TimeRangeKey; label: string; months: number | null }> =
  [
    { id: "1y", label: "1 ano", months: 12 },
    { id: "5y", label: "5 anos", months: 60 },
    { id: "all", label: "Total", months: null },
  ];

export interface ChartAreaInteractiveProps {
  title?: string;
  description?: string;
  views: ChartView[];
  defaultView?: string;
  defaultRange?: TimeRangeKey;
  className?: string;
  /** Optional banner rendered inside the card, above the chart body. */
  notice?: React.ReactNode;
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  payload?: ChartPoint;
  name?: string;
  color?: string;
}

interface TooltipContentProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipPayloadEntry[];
}

export function ChartAreaTooltipContent({
  active,
  label,
  payload,
}: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const monthValue =
    typeof label === "number"
      ? label
      : Number.isFinite(Number(label))
        ? Number(label)
        : 0;
  return (
    <div
      data-testid="chart-area-tooltip"
      className="bg-popover text-popover-foreground border-border rounded-md border px-3 py-2 text-xs shadow-md"
    >
      <p className="text-muted-foreground mb-1 font-medium">
        Mês {monthValue} · {formatMonths(monthValue)}
      </p>
      <dl className="space-y-0.5">
        {payload.map((entry, index) => (
          <div
            key={`${String(entry.dataKey ?? entry.name ?? index)}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <dt className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name ?? String(entry.dataKey ?? "")}
            </dt>
            <dd className="font-tabular font-semibold">
              {formatBRL(entry.value ?? 0)}
            </dd>
          </div>
        ))}
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

function sliceByRange(data: ChartPoint[], range: TimeRangeKey): ChartPoint[] {
  const rangeMeta = TIME_RANGES.find((r) => r.id === range);
  if (!rangeMeta || rangeMeta.months === null) return data;
  const limit = rangeMeta.months;
  return data.filter((point) => point.month <= limit);
}

interface ChartBodyProps {
  view: ChartView;
  range: TimeRangeKey;
}

function ChartBody({ view, range }: ChartBodyProps) {
  const filtered = React.useMemo(
    () => sliceByRange(view.data, range),
    [view.data, range],
  );

  const visibleMarkers = React.useMemo(() => {
    const markers = view.markers ?? [];
    if (markers.length === 0 || filtered.length === 0) return [];
    const lastMonth = filtered[filtered.length - 1].month;
    return markers.filter((marker) => marker.month <= lastMonth);
  }, [view.markers, filtered]);

  if (filtered.length === 0) {
    return (
      <p
        data-testid="chart-area-empty-state"
        className="text-muted-foreground flex h-[260px] items-center justify-center text-sm"
      >
        {view.emptyState ?? "Sem dados para exibir."}
      </p>
    );
  }

  const kind = view.kind ?? "line";

  return (
    <div
      data-testid="chart-area-canvas"
      data-view={view.id}
      data-range={range}
      data-point-count={filtered.length}
      data-marker-count={visibleMarkers.length}
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        {kind === "area" ? (
          <AreaChart data={filtered} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
            <Tooltip content={<ChartAreaTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {view.series.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stackId={series.stackId}
                stroke={series.color}
                strokeDasharray={series.strokeDasharray}
                strokeWidth={series.strokeWidth ?? 2}
                fill={series.color}
                fillOpacity={series.fillOpacity ?? 0.5}
                isAnimationActive={false}
              />
            ))}
            {visibleMarkers.map((marker) => (
              <ReferenceDot
                key={`${marker.month}-${marker.color}`}
                x={marker.month}
                y={marker.value}
                r={5}
                fill={marker.color}
                stroke="var(--background)"
                strokeWidth={2}
                isFront
                label={{
                  value: marker.label,
                  position: "top",
                  fontSize: 11,
                  fill: marker.color,
                }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={filtered} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
            <Tooltip content={<ChartAreaTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {view.series.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stroke={series.color}
                strokeDasharray={series.strokeDasharray}
                strokeWidth={series.strokeWidth ?? 2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {visibleMarkers.map((marker) => (
              <ReferenceDot
                key={`${marker.month}-${marker.color}`}
                x={marker.month}
                y={marker.value}
                r={5}
                fill={marker.color}
                stroke="var(--background)"
                strokeWidth={2}
                isFront
                label={{
                  value: marker.label,
                  position: "top",
                  fontSize: 11,
                  fill: marker.color,
                }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartAreaInteractive({
  title = "Visão geral",
  description,
  views,
  defaultView,
  defaultRange = "all",
  className,
  notice,
}: ChartAreaInteractiveProps) {
  const firstViewId = views[0]?.id ?? "";
  const [activeView, setActiveView] = React.useState<string>(
    defaultView ?? firstViewId,
  );
  const [range, setRange] = React.useState<TimeRangeKey>(defaultRange);

  const view =
    views.find((v) => v.id === activeView) ?? views[0] ?? null;
  const effectiveDescription = view?.description ?? description;

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader className="flex flex-col gap-3 @sm/card:flex-row @sm/card:items-start @sm/card:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {effectiveDescription ? (
            <CardDescription>{effectiveDescription}</CardDescription>
          ) : null}
        </div>
        <div
          role="group"
          aria-label="Intervalo de tempo"
          data-testid="chart-area-range-toggle"
          className="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center self-start rounded-lg p-1"
        >
          {TIME_RANGES.map((option) => {
            const isActive = option.id === range;
            return (
              <button
                key={option.id}
                type="button"
                data-state={isActive ? "active" : "inactive"}
                aria-pressed={isActive}
                onClick={() => setRange(option.id)}
                className={cn(
                  "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  isActive
                    ? "bg-background text-foreground shadow"
                    : "hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-2 pt-2 sm:px-6 sm:pt-4">
        {views.length > 1 ? (
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList data-testid="chart-area-view-tabs" className="flex-wrap">
              {views.map((v) => (
                <TabsTrigger key={v.id} value={v.id}>
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        {notice ?? null}
        {view ? (
          <ChartBody view={view} range={range} />
        ) : (
          <p className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
            Sem dados para exibir.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
