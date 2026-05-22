import {
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTrend = "up" | "down" | "neutral";

export interface KpiCardData {
  title: string;
  value: string;
  delta?: string;
  trend?: KpiTrend;
  hint?: string;
  icon?: LucideIcon;
}

export function SectionCards({ items = [] }: { items?: KpiCardData[] }) {
  if (items.length === 0) return null;
  return (
    <div
      data-slot="section-cards"
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
    >
      {items.map((item) => (
        <KpiCard key={item.title} item={item} />
      ))}
    </div>
  );
}

function KpiCard({ item }: { item: KpiCardData }) {
  const Icon = item.icon;
  const trend = item.trend ?? "neutral";
  const hasDelta = typeof item.delta === "string" && item.delta.length > 0;
  const testIdBase = `kpi-card-${slug(item.title)}`;
  return (
    <Card
      data-slot="card"
      data-testid={testIdBase}
      data-trend={hasDelta ? trend : undefined}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-sm leading-none font-medium">
            {item.title}
          </p>
          {Icon ? (
            <Icon
              className="text-muted-foreground h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div
          className="font-tabular text-2xl font-semibold tracking-tight @[250px]/card:text-3xl"
          data-testid={`${testIdBase}-value`}
        >
          {item.value}
        </div>
        {hasDelta ? <TrendBadge trend={trend} delta={item.delta!} /> : null}
        {item.hint ? (
          <p className="text-muted-foreground text-xs">{item.hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

function TrendBadge({ trend, delta }: { trend: KpiTrend; delta: string }) {
  const TrendIcon =
    trend === "up" ? ArrowUpIcon : trend === "down" ? ArrowDownIcon : MinusIcon;
  const tone =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <p
      data-testid="kpi-delta"
      data-trend={trend}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        tone,
      )}
    >
      <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{delta}</span>
    </p>
  );
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
