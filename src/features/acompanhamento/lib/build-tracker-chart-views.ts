import {
  type ChartMarker,
  type ChartView,
  type SeriesData,
} from "@/components/chart-area-interactive";
import type { ScheduleMonth } from "@/core/finance/tracker/normalSchedule";

import type { TrackerCurves } from "./build-curves";

const REALIZED_COLOR = "var(--chart-1)";
const NORMAL_COLOR = "var(--chart-3)";
const META_COLOR = "var(--chart-2)";

const REALIZED_KEY = "realizado";
const NORMAL_KEY = "normal";
const META_KEY = "meta";

export interface TrackerChartPoint {
  month: number;
  realizado: number;
  normal: number;
  meta?: number;
}

export interface TrackerChartViewsResult {
  views: ChartView[];
  metaInvalid: boolean;
}

/**
 * Acumulado mês a mês de uma curva: saldo devedor e juros acumulados indexados
 * por `monthIndex` (índice 0 = mês inicial, antes de qualquer pagamento).
 * `lastMonth` é o último mês com cronograma (quitação, possivelmente antecipada).
 */
interface CurveAccumulator {
  balanceByMonth: number[];
  interestByMonth: number[];
  lastMonth: number;
}

function accumulate(principal: number, months: ScheduleMonth[]): CurveAccumulator {
  const balanceByMonth: number[] = [principal];
  const interestByMonth: number[] = [0];
  let cumulativeInterest = 0;
  for (const row of months) {
    cumulativeInterest += row.interest.toNumber();
    balanceByMonth[row.monthIndex] = row.balance.toNumber();
    interestByMonth[row.monthIndex] = cumulativeInterest;
  }
  return { balanceByMonth, interestByMonth, lastMonth: months.length };
}

function balanceAt(curve: CurveAccumulator, month: number): number {
  return month <= curve.lastMonth ? curve.balanceByMonth[month] : 0;
}

function interestAt(curve: CurveAccumulator, month: number): number {
  const clamped = Math.min(month, curve.lastMonth);
  return curve.interestByMonth[clamped] ?? 0;
}

function seriesFor(includeMeta: boolean): SeriesData[] {
  const series: SeriesData[] = [
    { key: REALIZED_KEY, name: "Realizado", color: REALIZED_COLOR, strokeWidth: 2.5 },
    {
      key: NORMAL_KEY,
      name: "Normal",
      color: NORMAL_COLOR,
      strokeDasharray: "6 4",
      strokeWidth: 2,
    },
  ];
  if (includeMeta) {
    series.push({ key: META_KEY, name: "Meta", color: META_COLOR, strokeWidth: 1.5 });
  }
  return series;
}

/**
 * Transforma as três curvas (Normal, Realizado, Meta) em duas `ChartView`
 * ("Saldo devedor" e "Juros acumulados") para o `ChartAreaInteractive`.
 * A série Meta é omitida quando o plano-meta é inviável (`goal.invalidAtMonth`);
 * nesse caso `metaInvalid` é true para a UI mostrar o aviso. Marcadores de
 * quitação antecipada são adicionados ao Realizado/Meta quando quitam antes do
 * prazo Normal.
 */
export function buildTrackerChartViews(
  curves: TrackerCurves,
): TrackerChartViewsResult {
  const principal = curves.planInput.principal.toNumber();
  const term = curves.normal.length;
  const metaInvalid = curves.goal.invalidAtMonth != null;
  const includeMeta = !metaInvalid;

  const normal = accumulate(principal, curves.normal);
  const realized = accumulate(principal, curves.realized.months);
  const meta = includeMeta
    ? accumulate(principal, curves.goal.months)
    : null;

  const balanceData: TrackerChartPoint[] = [];
  const interestData: TrackerChartPoint[] = [];
  for (let month = 0; month <= term; month++) {
    const balancePoint: TrackerChartPoint = {
      month,
      realizado: balanceAt(realized, month),
      normal: balanceAt(normal, month),
    };
    const interestPoint: TrackerChartPoint = {
      month,
      realizado: interestAt(realized, month),
      normal: interestAt(normal, month),
    };
    if (meta) {
      balancePoint.meta = balanceAt(meta, month);
      interestPoint.meta = interestAt(meta, month);
    }
    balanceData.push(balancePoint);
    interestData.push(interestPoint);
  }

  const realizedPayoff = curves.realized.paidOffAtMonth;
  const metaPayoff = includeMeta ? curves.goal.paidOffAtMonth : null;
  const realizedEarly = realizedPayoff != null && realizedPayoff < term;
  const metaEarly = metaPayoff != null && metaPayoff < term;

  const balanceMarkers: ChartMarker[] = [];
  const interestMarkers: ChartMarker[] = [];
  if (realizedEarly && realizedPayoff != null) {
    const label = `Quitado em mês ${realizedPayoff}`;
    balanceMarkers.push({ month: realizedPayoff, value: 0, label, color: REALIZED_COLOR });
    interestMarkers.push({
      month: realizedPayoff,
      value: interestAt(realized, realizedPayoff),
      label,
      color: REALIZED_COLOR,
    });
  }
  if (metaEarly && metaPayoff != null && meta) {
    const label = `Quitado em mês ${metaPayoff}`;
    balanceMarkers.push({ month: metaPayoff, value: 0, label, color: META_COLOR });
    interestMarkers.push({
      month: metaPayoff,
      value: interestAt(meta, metaPayoff),
      label,
      color: META_COLOR,
    });
  }

  const series = seriesFor(includeMeta);

  return {
    metaInvalid,
    views: [
      {
        id: "balance",
        label: "Saldo devedor",
        description:
          "Saldo devedor ao longo do tempo: realizado, cronograma normal e plano-meta.",
        kind: "line",
        data: balanceData,
        series,
        markers: balanceMarkers,
        emptyState: "Sem dados para exibir a curva de saldo devedor.",
      },
      {
        id: "interest",
        label: "Juros acumulados",
        description:
          "Juros acumulados ao longo do tempo: realizado, cronograma normal e plano-meta.",
        kind: "line",
        data: interestData,
        series,
        markers: interestMarkers,
        emptyState: "Sem dados para exibir a curva de juros acumulados.",
      },
    ],
  };
}
