import Decimal from "decimal.js";

import {
  generatePriceSchedule,
  generateSacSchedule,
} from "@/core/finance/amortization";
import {
  type FinancingInputs,
  type ScheduleRow,
  roundMoney,
  summarizeSchedule,
} from "@/core/finance/financial-types";
import { resolveExtraSchedule } from "@/core/finance/extra-schedule";
import type { PrepaymentResult } from "@/core/finance/prepayment";
import { calculatePriceInstallment } from "@/core/finance/price-calculator";
import {
  compareRentVsBuy,
  type RentVsBuyInputs,
  type RentVsBuyResult,
} from "@/core/finance/rent-vs-buy";
import type { ExtraPaymentStrategy } from "@/features/simulator/hooks/simulation-context";
import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

export interface ExportPayload {
  financing: FinancingFormValues;
  extraMonthly: number | null;
  extraStrategy: ExtraPaymentStrategy;
  rentVsBuy: RentVsBuyFormValues | null;
}

export const CURRENCY_FORMAT = 'R$ #,##0.00';
export const PERCENT_FORMAT = '0,00%';

type StringCell = { v: string; t: "s" };
type NumberCell = { v: number; t: "n"; z?: string };
export type ExportCell = string | StringCell | NumberCell;

// Sheet names truncated to fit Excel's 31-char ceiling — SheetJS throws on
// any name longer than that, so the PRD's "Financiamento + Parcela Desejada
// (Reduzir Prazo)" form cannot be used verbatim. Kept short and clear:
// "Parcela Desejada (Prazo)" / "(Parcela)" — the strategy is implied because
// "Reduzir" is the only operation, and the column headers spell it out anyway.
export const SHEET_NAMES = [
  "Resumo",
  "Premissas",
  "Financiamento Base",
  "Parcela Desejada (Prazo)",
  "Parcela Desejada (Parcela)",
  "Aluguel vs Compra",
  "Tabela Comparativa",
] as const;

const ZERO = new Decimal(0);

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

function buildRentVsBuyInputs(
  financing: FinancingFormValues,
  values: RentVsBuyFormValues,
): RentVsBuyInputs {
  return {
    propertyValue: new Decimal(financing.propertyValue),
    downPayment: new Decimal(financing.downPayment),
    monthlyRate: new Decimal(financing.monthlyRate).div(100),
    termMonths: financing.termMonths,
    system: financing.system,
    monthlyRent: new Decimal(values.monthlyRent),
    annualRentAdjustment: new Decimal(values.annualRentAdjustment).div(100),
    annualInvestmentReturn: new Decimal(values.annualInvestmentReturn).div(100),
    annualAppreciation: new Decimal(values.annualAppreciation).div(100),
    monthlyOwnershipCosts: new Decimal(values.monthlyOwnershipCosts),
    horizonMonths: values.horizonMonths,
  };
}

function baseScheduleOf(inputs: FinancingInputs): ScheduleRow[] {
  return inputs.system === "SAC"
    ? generateSacSchedule(inputs)
    : generatePriceSchedule(inputs);
}

interface ExtraResults {
  reduceTerm: PrepaymentResult;
  reduceInstallment: PrepaymentResult;
}

function computeExtra(
  inputs: FinancingInputs,
  extraMonthly: number,
): ExtraResults {
  const extra = new Decimal(extraMonthly);
  return {
    reduceTerm: resolveExtraSchedule(inputs, extra, "term"),
    reduceInstallment: resolveExtraSchedule(inputs, extra, "installment"),
  };
}

function derivedTargetMonthlyPayment(
  inputs: FinancingInputs,
  extraMonthly: number,
): Decimal {
  const basePriceInstallment = roundMoney(
    calculatePriceInstallment({
      principal: inputs.principal,
      monthlyRate: inputs.monthlyRate,
      termMonths: inputs.termMonths,
    }),
  );
  return roundMoney(basePriceInstallment.plus(extraMonthly));
}

function tryRentVsBuy(
  financing: FinancingFormValues,
  rentVsBuy: RentVsBuyFormValues | null,
): RentVsBuyResult | null {
  if (!rentVsBuy) return null;
  try {
    return compareRentVsBuy(buildRentVsBuyInputs(financing, rentVsBuy));
  } catch {
    return null;
  }
}

function strategyLabel(strategy: ExtraPaymentStrategy): string {
  return strategy === "installment" ? "Reduzir parcela" : "Reduzir prazo";
}

function scenarioLabel(scenario: RentVsBuyResult["summary"]["bestScenario"]): string {
  switch (scenario) {
    case "buy":
      return "Comprar";
    case "rent":
      return "Alugar e investir";
    default:
      return "Empate";
  }
}

export function buildResumoSheet(payload: ExportPayload): ExportCell[][] {
  const { financing, extraMonthly, extraStrategy, rentVsBuy } = payload;
  const inputs = buildFinancingInputs(financing);
  const baseSchedule = baseScheduleOf(inputs);
  const baseSummary = summarizeSchedule(baseSchedule, inputs.termMonths);
  const initialInstallment = baseSchedule[0]?.installment ?? ZERO;

  const rows: ExportCell[][] = [
    [txt("Resumo da simulação")],
    [txt("Métrica"), txt("Valor")],
    [txt("Valor do imóvel"), money(financing.propertyValue)],
    [txt("Entrada"), money(financing.downPayment)],
    [txt("Valor financiado"), money(inputs.principal)],
    [txt("Sistema de amortização"), txt(financing.system)],
    [txt("Taxa mensal"), percent(new Decimal(financing.monthlyRate).div(100))],
    [txt("Prazo original (meses)"), integer(financing.termMonths)],
    [txt("Parcela inicial"), money(initialInstallment)],
    [txt("Total pago (base)"), money(baseSummary.totalPaid)],
    [txt("Total de juros (base)"), money(baseSummary.totalInterest)],
  ];

  if (extraMonthly !== null && extraMonthly > 0) {
    const extra = computeExtra(inputs, extraMonthly);
    const active =
      extraStrategy === "installment" ? extra.reduceInstallment : extra.reduceTerm;
    const target = derivedTargetMonthlyPayment(inputs, extraMonthly);
    rows.push(
      [txt("Parcela mensal desejada"), money(target)],
      [txt("Extra mensal derivado"), money(extraMonthly)],
      [txt("Estratégia ativa"), txt(strategyLabel(extraStrategy))],
      [txt("Total pago (com extra)"), money(active.summary.totalPaid)],
      [txt("Economia em juros"), money(active.summary.interestSaved)],
      [txt("Novo prazo (meses)"), integer(active.summary.newTermMonths)],
      [txt("Meses reduzidos"), integer(active.summary.monthsReduced)],
    );
  }

  const rvb = tryRentVsBuy(financing, rentVsBuy);
  if (rvb && rentVsBuy) {
    const finalBuy = rvb.buyTimeline[rvb.buyTimeline.length - 1];
    const finalRent = rvb.rentTimeline[rvb.rentTimeline.length - 1];
    rows.push(
      [txt("Aluguel inicial"), money(rentVsBuy.monthlyRent)],
      [txt("Horizonte (meses)"), integer(rentVsBuy.horizonMonths)],
      [txt("Melhor cenário"), txt(scenarioLabel(rvb.summary.bestScenario))],
      [txt("Patrimônio final (comprar)"), money(finalBuy.netWorth)],
      [txt("Patrimônio final (alugar)"), money(finalRent.netWorth)],
      [txt("Diferença"), money(rvb.summary.netWorthDifferenceFinal)],
      [
        txt("Ponto de equilíbrio (mês)"),
        rvb.summary.breakEvenMonth === null
          ? txt("Não atinge")
          : integer(rvb.summary.breakEvenMonth),
      ],
    );
  }

  return rows;
}

export function buildPremissasSheet(payload: ExportPayload): ExportCell[][] {
  const { financing, extraMonthly, extraStrategy, rentVsBuy } = payload;
  const rows: ExportCell[][] = [
    [txt("Premissas")],
    [txt("Parâmetro"), txt("Valor")],
    [txt("Valor do imóvel"), money(financing.propertyValue)],
    [txt("Entrada"), money(financing.downPayment)],
    [txt("Taxa mensal"), percent(new Decimal(financing.monthlyRate).div(100))],
    [txt("Prazo (meses)"), integer(financing.termMonths)],
    [txt("Sistema de amortização"), txt(financing.system)],
  ];

  if (extraMonthly !== null && extraMonthly > 0) {
    const inputs = buildFinancingInputs(financing);
    const target = derivedTargetMonthlyPayment(inputs, extraMonthly);
    rows.push(
      [txt("Parcela mensal desejada"), money(target)],
      [txt("Extra mensal derivado"), money(extraMonthly)],
      [txt("Estratégia de pagamento extra"), txt(strategyLabel(extraStrategy))],
    );
  }

  if (rentVsBuy) {
    rows.push(
      [txt("Aluguel mensal"), money(rentVsBuy.monthlyRent)],
      [
        txt("Reajuste anual do aluguel"),
        percent(new Decimal(rentVsBuy.annualRentAdjustment).div(100)),
      ],
      [
        txt("Rendimento anual do investimento"),
        percent(new Decimal(rentVsBuy.annualInvestmentReturn).div(100)),
      ],
      [
        txt("Valorização anual do imóvel"),
        percent(new Decimal(rentVsBuy.annualAppreciation).div(100)),
      ],
      [txt("Custos mensais de propriedade"), money(rentVsBuy.monthlyOwnershipCosts)],
      [txt("Horizonte (meses)"), integer(rentVsBuy.horizonMonths)],
    );
  }

  return rows;
}

export function buildBaseScheduleSheet(payload: ExportPayload): ExportCell[][] {
  const inputs = buildFinancingInputs(payload.financing);
  const schedule = baseScheduleOf(inputs);
  const rows: ExportCell[][] = [
    [
      txt("Mês"),
      txt("Parcela"),
      txt("Juros"),
      txt("Amortização"),
      txt("Saldo devedor"),
    ],
  ];
  for (const row of schedule) {
    rows.push([
      integer(row.month),
      money(row.installment),
      money(row.interest),
      money(row.amortization),
      money(row.balance),
    ]);
  }
  return rows;
}

function buildPrepaymentScheduleSheet(
  payload: ExportPayload,
  strategy: "term" | "installment",
): ExportCell[][] {
  if (payload.extraMonthly === null || payload.extraMonthly <= 0) {
    return [
      [
        txt(
          "Informe uma parcela mensal desejada na simulação para gerar esta planilha.",
        ),
      ],
    ];
  }
  const inputs = buildFinancingInputs(payload.financing);
  const extra = new Decimal(payload.extraMonthly);
  const result = resolveExtraSchedule(inputs, extra, strategy);
  const target = derivedTargetMonthlyPayment(inputs, payload.extraMonthly);
  const derivedExtra = new Decimal(payload.extraMonthly);

  const rows: ExportCell[][] = [
    [
      txt("Mês"),
      txt("Parcela desejada"),
      txt("Extra derivado"),
      txt("Parcela base"),
      txt("Pagamento extra"),
      txt("Pagamento total"),
      txt("Juros"),
      txt("Amortização"),
      txt("Saldo devedor"),
    ],
  ];
  for (const row of result.schedule) {
    rows.push([
      integer(row.month),
      money(target),
      money(derivedExtra),
      money(row.baseInstallment),
      money(row.extraPayment),
      money(row.installment),
      money(row.interest),
      money(row.amortization),
      money(row.balance),
    ]);
  }
  return rows;
}

export function buildExtraTermSheet(payload: ExportPayload): ExportCell[][] {
  return buildPrepaymentScheduleSheet(payload, "term");
}

export function buildExtraInstallmentSheet(payload: ExportPayload): ExportCell[][] {
  return buildPrepaymentScheduleSheet(payload, "installment");
}

export function buildRentVsBuySheet(payload: ExportPayload): ExportCell[][] {
  const rvb = tryRentVsBuy(payload.financing, payload.rentVsBuy);
  if (!rvb) {
    return [
      [
        txt(
          "Configure os dados de aluguel vs. compra para gerar esta planilha.",
        ),
      ],
    ];
  }
  const rows: ExportCell[][] = [
    [
      txt("Mês"),
      txt("Aluguel"),
      txt("Patrimônio (comprar)"),
      txt("Valor do imóvel"),
      txt("Saldo devedor"),
      txt("Capital investido (comprar)"),
      txt("Patrimônio (alugar)"),
      txt("Diferença (comprar − alugar)"),
    ],
  ];
  const horizon = rvb.buyTimeline.length;
  for (let i = 0; i < horizon; i++) {
    const buy = rvb.buyTimeline[i];
    const rent = rvb.rentTimeline[i];
    const diff = buy.netWorth.minus(rent.netWorth);
    rows.push([
      integer(buy.month),
      money(rent.rent),
      money(buy.netWorth),
      money(buy.propertyValue),
      money(buy.outstandingBalance),
      money(buy.investedCapital),
      money(rent.netWorth),
      money(diff),
    ]);
  }
  return rows;
}

export function buildComparativeSheet(payload: ExportPayload): ExportCell[][] {
  const inputs = buildFinancingInputs(payload.financing);
  const baseSchedule = baseScheduleOf(inputs);
  const baseSummary = summarizeSchedule(baseSchedule, inputs.termMonths);
  const baseInitial = baseSchedule[0]?.installment ?? ZERO;

  const hasExtra = payload.extraMonthly !== null && payload.extraMonthly > 0;
  const extra = hasExtra ? computeExtra(inputs, payload.extraMonthly!) : null;

  const header: ExportCell[] = [
    txt("Métrica"),
    txt("Base"),
    txt("Reduzir Prazo"),
    txt("Reduzir Parcela"),
  ];

  const dash: ExportCell = txt("—");
  const rt = extra?.reduceTerm.summary;
  const ri = extra?.reduceInstallment.summary;

  const rows: ExportCell[][] = [
    [txt("Comparativo de cenários")],
    header,
    [
      txt("Parcela inicial"),
      money(baseInitial),
      money(baseInitial),
      money(baseInitial),
    ],
    [
      txt("Total pago"),
      money(baseSummary.totalPaid),
      rt ? money(rt.totalPaid) : dash,
      ri ? money(ri.totalPaid) : dash,
    ],
    [
      txt("Total de juros"),
      money(baseSummary.totalInterest),
      rt ? money(rt.totalInterest) : dash,
      ri ? money(ri.totalInterest) : dash,
    ],
    [
      txt("Prazo (meses)"),
      integer(inputs.termMonths),
      rt ? integer(rt.newTermMonths) : dash,
      ri ? integer(ri.newTermMonths) : dash,
    ],
    [
      txt("Meses reduzidos"),
      integer(0),
      rt ? integer(rt.monthsReduced) : dash,
      ri ? integer(ri.monthsReduced) : dash,
    ],
    [
      txt("Economia em juros"),
      money(0),
      rt ? money(rt.interestSaved) : dash,
      ri ? money(ri.interestSaved) : dash,
    ],
  ];

  return rows;
}

export function getExportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `simulacao-financiamento-${yyyy}-${mm}-${dd}.xlsx`;
}

const SHEET_BUILDERS = [
  buildResumoSheet,
  buildPremissasSheet,
  buildBaseScheduleSheet,
  buildExtraTermSheet,
  buildExtraInstallmentSheet,
  buildRentVsBuySheet,
  buildComparativeSheet,
] as const;

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

export async function exportSimulation(payload: ExportPayload): Promise<void> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();

  SHEET_NAMES.forEach((name, idx) => {
    const aoa = SHEET_BUILDERS[idx](payload);
    const sheet = xlsx.utils.aoa_to_sheet(aoa);
    xlsx.utils.book_append_sheet(workbook, sheet, name);
  });

  const buffer = xlsx.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, getExportFilename());
}
