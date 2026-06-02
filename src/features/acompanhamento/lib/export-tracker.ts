import Decimal from "decimal.js";

import type { ScheduleMonth } from "@/core/finance/tracker/normalSchedule";
import {
  buildCurves,
  type TrackerCurves,
} from "@/features/acompanhamento/lib/build-curves";
import { dueDateBR } from "@/features/acompanhamento/lib/due-date";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

export const CURRENCY_FORMAT = "R$ #,##0.00";
export const PERCENT_FORMAT = "0,00%";

type StringCell = { v: string; t: "s" };
type NumberCell = { v: number; t: "n"; z?: string };
export type ExportCell = string | StringCell | NumberCell;

/** Abas do export, na ordem em que são geradas (≤ 31 chars, limite do Excel). */
export const TRACKER_SHEET_NAMES = [
  "Plano",
  "Lançamentos",
  "Cronograma Realizado",
  "Cronograma Normal",
  "Cronograma Meta",
  "Comparativo",
] as const;

const META_INVALID_MESSAGE =
  "Valor-meta menor que a parcela inicial. Ajuste o plano para visualizar a curva.";

function txt(value: string): StringCell {
  return { v: value, t: "s" };
}

function money(value: Decimal | number): NumberCell {
  const v = typeof value === "number" ? value : value.toNumber();
  return { v, t: "n", z: CURRENCY_FORMAT };
}

function percent(fraction: Decimal | number): NumberCell {
  const v = typeof fraction === "number" ? fraction : fraction.toNumber();
  return { v, t: "n", z: PERCENT_FORMAT };
}

function integer(value: number): NumberCell {
  return { v: value, t: "n" };
}

function applyModeLabel(mode: TrackerEntryApi["apply_mode"]): string {
  return mode === "reduce_installment" ? "Reduzir parcela" : "Reduzir prazo";
}

export function buildPlanoSheet(plan: TrackerPlanApi): ExportCell[][] {
  const principal = new Decimal(
    plan.property_value_cents - plan.down_payment_cents,
  ).div(100);
  const annualRate = new Decimal(plan.annual_rate_bp).div(10_000);

  return [
    [txt("Plano de acompanhamento")],
    [txt("Campo"), txt("Valor")],
    [txt("Nome"), txt(plan.name)],
    [txt("Valor do imóvel"), money(plan.property_value_cents / 100)],
    [txt("Entrada"), money(plan.down_payment_cents / 100)],
    [txt("Valor financiado"), money(principal)],
    [txt("Sistema de amortização"), txt(plan.modality)],
    [txt("Taxa anual"), percent(annualRate)],
    [txt("Prazo (meses)"), integer(plan.term_months)],
    [txt("Data de início"), txt(plan.start_date)],
    [
      txt("Valor mensal-meta"),
      money(plan.target_monthly_total_cents / 100),
    ],
  ];
}

export function buildLancamentosSheet(
  plan: TrackerPlanApi,
  entries: TrackerEntryApi[],
): ExportCell[][] {
  const header: ExportCell[] = [
    txt("Mês"),
    txt("Vencimento"),
    txt("Pago"),
    txt("Modo"),
    txt("Nota"),
  ];

  if (entries.length === 0) {
    return [header, [txt("Nenhum lançamento registrado.")]];
  }

  const rows: ExportCell[][] = [header];
  const sorted = [...entries].sort((a, b) => a.month_index - b.month_index);
  for (const entry of sorted) {
    rows.push([
      integer(entry.month_index),
      txt(dueDateBR(plan.start_date, entry.month_index - 1)),
      money(entry.paid_amount_cents / 100),
      txt(applyModeLabel(entry.apply_mode)),
      txt(entry.note ?? ""),
    ]);
  }
  return rows;
}

/**
 * Monta uma aba de cronograma com uma linha por mês até `termMonths`. Meses
 * sem row no cronograma (truncados por quitação antecipada) saem com status
 * "Quitado", parcela/juros/amortização/saldo zerados — para conferência lado a
 * lado com a curva Normal (que vai sempre até o fim do termo).
 */
function buildScheduleSheet(
  months: ScheduleMonth[],
  termMonths: number,
  startDate: string,
): ExportCell[][] {
  const rows: ExportCell[][] = [
    [
      txt("Mês"),
      txt("Vencimento"),
      txt("Parcela"),
      txt("Juros"),
      txt("Amortização"),
      txt("Saldo devedor"),
      txt("Status"),
    ],
  ];

  const byMonth = new Map<number, ScheduleMonth>();
  for (const month of months) byMonth.set(month.monthIndex, month);

  for (let month = 1; month <= termMonths; month++) {
    const data = byMonth.get(month);
    if (data) {
      rows.push([
        integer(month),
        txt(dueDateBR(startDate, month - 1)),
        money(data.installment),
        money(data.interest),
        money(data.amortization),
        money(data.balance),
        txt("Ativo"),
      ]);
    } else {
      rows.push([
        integer(month),
        txt(dueDateBR(startDate, month - 1)),
        money(0),
        money(0),
        money(0),
        money(0),
        txt("Quitado"),
      ]);
    }
  }
  return rows;
}

export function buildCronogramaRealizadoSheet(
  curves: TrackerCurves,
  plan: TrackerPlanApi,
): ExportCell[][] {
  return buildScheduleSheet(
    curves.realized.months,
    plan.term_months,
    plan.start_date,
  );
}

export function buildCronogramaNormalSheet(
  curves: TrackerCurves,
  plan: TrackerPlanApi,
): ExportCell[][] {
  return buildScheduleSheet(curves.normal, plan.term_months, plan.start_date);
}

export function buildCronogramaMetaSheet(
  curves: TrackerCurves,
  plan: TrackerPlanApi,
): ExportCell[][] {
  if (curves.goal.invalidAtMonth !== null) {
    return [[txt("Cronograma Meta")], [txt(META_INVALID_MESSAGE)]];
  }
  return buildScheduleSheet(
    curves.goal.months,
    plan.term_months,
    plan.start_date,
  );
}

/** Saldo de uma curva no mês dado; 0 após a quitação, null quando indisponível. */
function balanceAtMonth(
  months: ScheduleMonth[],
  month: number,
): Decimal | null {
  const last = months[months.length - 1];
  if (!last) return null;
  if (month > last.monthIndex) return new Decimal(0);
  const data = months[month - 1];
  return data ? data.balance : null;
}

export function buildComparativoSheet(
  curves: TrackerCurves,
  plan: TrackerPlanApi,
): ExportCell[][] {
  const rows: ExportCell[][] = [
    [
      txt("Mês"),
      txt("Vencimento"),
      txt("Saldo Realizado"),
      txt("Saldo Normal"),
      txt("Saldo Meta"),
    ],
  ];

  const metaInvalid = curves.goal.invalidAtMonth !== null;

  for (let month = 1; month <= plan.term_months; month++) {
    const realized = balanceAtMonth(curves.realized.months, month);
    const normal = balanceAtMonth(curves.normal, month);
    const meta = metaInvalid
      ? null
      : balanceAtMonth(curves.goal.months, month);

    rows.push([
      integer(month),
      txt(dueDateBR(plan.start_date, month - 1)),
      realized === null ? txt("—") : money(realized),
      normal === null ? txt("—") : money(normal),
      meta === null ? txt("—") : money(meta),
    ]);
  }
  return rows;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTrackerExportFilename(
  planName: string,
  now: Date = new Date(),
): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const slug = slugify(planName);
  const base = slug ? `acompanhamento-${slug}` : "acompanhamento";
  return `${base}-${yyyy}-${mm}-${dd}.xlsx`;
}

function buildTrackerSheets(
  plan: TrackerPlanApi,
  entries: TrackerEntryApi[],
): ExportCell[][][] {
  const curves = buildCurves(plan, entries);
  return [
    buildPlanoSheet(plan),
    buildLancamentosSheet(plan, entries),
    buildCronogramaRealizadoSheet(curves, plan),
    buildCronogramaNormalSheet(curves, plan),
    buildCronogramaMetaSheet(curves, plan),
    buildComparativoSheet(curves, plan),
  ];
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportTracker(
  plan: TrackerPlanApi,
  entries: TrackerEntryApi[],
): Promise<void> {
  const sheets = buildTrackerSheets(plan, entries);

  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();

  TRACKER_SHEET_NAMES.forEach((name, idx) => {
    const sheet = xlsx.utils.aoa_to_sheet(sheets[idx]);
    xlsx.utils.book_append_sheet(workbook, sheet, name);
  });

  const buffer = xlsx.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, getTrackerExportFilename(plan.name));
}
