import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Decimal from "decimal.js";

import {
  CURRENCY_FORMAT,
  PERCENT_FORMAT,
  SHEET_NAMES,
  buildBaseScheduleSheet,
  buildComparativeSheet,
  buildExtraInstallmentSheet,
  buildExtraTermSheet,
  buildPremissasSheet,
  buildRentVsBuySheet,
  buildResumoSheet,
  getExportFilename,
  type ExportCell,
  type ExportPayload,
} from "@/lib/export/excel-export";
import {
  generatePriceSchedule,
} from "@/core/finance/amortization";

const baseFinancing: ExportPayload["financing"] = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 1,
  termMonths: 360,
  system: "PRICE",
};

const baseRentVsBuy: ExportPayload["rentVsBuy"] = {
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  annualRate: 12,
  monthlyRent: 2500,
  annualRentAdjustment: 5,
  annualInvestmentReturn: 10,
  annualAppreciation: 6,
  purchaseCostPct: 3,
  saleCostPct: 6,
  monthlyOwnershipCosts: 500,
  horizonMonths: 120,
};

function payload(over: Partial<ExportPayload> = {}): ExportPayload {
  return {
    financing: baseFinancing,
    extraMonthly: null,
    extraStrategy: "term",
    rentVsBuy: null,
    ...over,
  };
}

function isNumberCell(
  cell: ExportCell,
): cell is { v: number; t: "n"; z?: string } {
  return typeof cell === "object" && cell !== null && cell.t === "n";
}

function isStringCell(cell: ExportCell): cell is { v: string; t: "s" } {
  return typeof cell === "object" && cell !== null && cell.t === "s";
}

function firstColumn(rows: ExportCell[][]): string[] {
  return rows
    .map((r) => (isStringCell(r[0]) ? r[0].v : ""))
    .filter((v) => v !== "");
}

describe("buildResumoSheet", () => {
  it("includes core financing metrics with currency/percent formats", () => {
    const rows = buildResumoSheet(payload());
    const labels = firstColumn(rows);
    expect(labels).toContain("Valor do imóvel");
    expect(labels).toContain("Valor financiado");
    expect(labels).toContain("Total pago (base)");
    expect(labels).toContain("Total de juros (base)");

    const propertyRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Valor do imóvel",
    );
    const propertyCell = propertyRow?.[1];
    expect(isNumberCell(propertyCell!)).toBe(true);
    if (!isNumberCell(propertyCell!)) throw new Error("expected number");
    expect(propertyCell.v).toBe(500_000);
    expect(propertyCell.z).toBe(CURRENCY_FORMAT);

    const rateRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Taxa mensal",
    );
    const rateCell = rateRow?.[1];
    expect(isNumberCell(rateCell!)).toBe(true);
    if (!isNumberCell(rateCell!)) throw new Error("expected number");
    expect(rateCell.v).toBeCloseTo(0.01, 6);
    expect(rateCell.z).toBe(PERCENT_FORMAT);
  });

  it("adds extra-payment rows only when extraMonthly > 0", () => {
    const labelsNoExtra = firstColumn(buildResumoSheet(payload()));
    expect(labelsNoExtra).not.toContain("Parcela mensal desejada");
    expect(labelsNoExtra).not.toContain("Extra mensal derivado");

    const labelsWithExtra = firstColumn(
      buildResumoSheet(payload({ extraMonthly: 1000, extraStrategy: "term" })),
    );
    expect(labelsWithExtra).toContain("Parcela mensal desejada");
    expect(labelsWithExtra).toContain("Extra mensal derivado");
    expect(labelsWithExtra).toContain("Economia em juros");
  });

  it("reports the derived target monthly payment as base PRICE installment + extra", () => {
    const rows = buildResumoSheet(
      payload({ extraMonthly: 1000, extraStrategy: "term" }),
    );
    const targetRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Parcela mensal desejada",
    );
    expect(targetRow).toBeDefined();
    const targetCell = targetRow?.[1];
    expect(isNumberCell(targetCell!)).toBe(true);
    if (!isNumberCell(targetCell!)) throw new Error("expected number");

    const engineSchedule = generatePriceSchedule({
      principal: new Decimal(400_000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 360,
    });
    const expected = engineSchedule[0].installment
      .toDecimalPlaces(2)
      .plus(1000)
      .toDecimalPlaces(2)
      .toNumber();
    expect(targetCell.v).toBeCloseTo(expected, 2);
    expect(targetCell.z).toBe(CURRENCY_FORMAT);

    const derivedExtraRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Extra mensal derivado",
    );
    const derivedExtraCell = derivedExtraRow?.[1];
    expect(isNumberCell(derivedExtraCell!)).toBe(true);
    if (!isNumberCell(derivedExtraCell!)) throw new Error("expected number");
    expect(derivedExtraCell.v).toBe(1000);
  });

  it("adds rent-vs-buy rows when rentVsBuy state is present", () => {
    const labels = firstColumn(
      buildResumoSheet(payload({ rentVsBuy: baseRentVsBuy })),
    );
    expect(labels).toContain("Melhor cenário");
    expect(labels).toContain("Patrimônio final (comprar)");
  });
});

describe("buildPremissasSheet", () => {
  it("lists all financing parameters", () => {
    const labels = firstColumn(buildPremissasSheet(payload()));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Valor do imóvel",
        "Entrada",
        "Taxa mensal",
        "Prazo (meses)",
        "Sistema de amortização",
      ]),
    );
  });

  it("includes rent-vs-buy parameters when provided", () => {
    const labels = firstColumn(
      buildPremissasSheet(payload({ rentVsBuy: baseRentVsBuy })),
    );
    expect(labels).toContain("Aluguel mensal");
    expect(labels).toContain("Horizonte (meses)");
    expect(labels).toContain("Rendimento anual do investimento");
  });

  it("adds target-payment rows when extraMonthly > 0", () => {
    const labels = firstColumn(
      buildPremissasSheet(
        payload({ extraMonthly: 1000, extraStrategy: "term" }),
      ),
    );
    expect(labels).toContain("Parcela mensal desejada");
    expect(labels).toContain("Extra mensal derivado");
    expect(labels).toContain("Estratégia de pagamento extra");
  });
});

describe("buildBaseScheduleSheet", () => {
  it("emits one header row plus termMonths data rows", () => {
    const rows = buildBaseScheduleSheet(payload());
    expect(rows.length).toBe(361);
    expect(isStringCell(rows[0][0]) && rows[0][0].v).toBe("Mês");
  });

  it("uses the same numbers as the engine (no duplicated computation)", () => {
    const rows = buildBaseScheduleSheet(payload());
    const firstDataRow = rows[1];
    const monthCell = firstDataRow[0];
    const installmentCell = firstDataRow[1];
    expect(isNumberCell(monthCell)).toBe(true);
    expect(isNumberCell(installmentCell)).toBe(true);
    if (!isNumberCell(monthCell) || !isNumberCell(installmentCell)) return;
    expect(monthCell.v).toBe(1);

    const engineSchedule = generatePriceSchedule({
      principal: new Decimal(400_000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 360,
    });
    expect(installmentCell.v).toBe(engineSchedule[0].installment.toNumber());
    expect(installmentCell.z).toBe(CURRENCY_FORMAT);
  });
});

describe("buildExtraTermSheet", () => {
  it("returns a placeholder message when no extra payment is configured", () => {
    const rows = buildExtraTermSheet(payload());
    expect(rows.length).toBe(1);
    expect(isStringCell(rows[0][0]) && rows[0][0].v).toMatch(
      /informe uma parcela mensal desejada/i,
    );
  });

  it("emits header + schedule with the parcela desejada + extra derivado columns", () => {
    const rows = buildExtraTermSheet(
      payload({ extraMonthly: 1000, extraStrategy: "term" }),
    );
    expect(rows[0]).toHaveLength(9);
    expect(isStringCell(rows[0][1]) && rows[0][1].v).toBe("Parcela desejada");
    expect(isStringCell(rows[0][2]) && rows[0][2].v).toBe("Extra derivado");
    expect(isStringCell(rows[0][3]) && rows[0][3].v).toBe("Parcela base");
    expect(isStringCell(rows[0][4]) && rows[0][4].v).toBe("Pagamento extra");
    expect(rows.length).toBeGreaterThan(2);

    const firstData = rows[1];
    const engineSchedule = generatePriceSchedule({
      principal: new Decimal(400_000),
      monthlyRate: new Decimal("0.01"),
      termMonths: 360,
    });
    const expectedTarget = engineSchedule[0].installment
      .toDecimalPlaces(2)
      .plus(1000)
      .toDecimalPlaces(2)
      .toNumber();
    expect(isNumberCell(firstData[1]) && firstData[1].v).toBeCloseTo(
      expectedTarget,
      2,
    );
    expect(isNumberCell(firstData[2]) && firstData[2].v).toBe(1000);
    expect(isNumberCell(firstData[4]) && firstData[4].v).toBe(1000);
  });

  it("keeps the parcela desejada column constant across all rows", () => {
    const rows = buildExtraTermSheet(
      payload({ extraMonthly: 1000, extraStrategy: "term" }),
    );
    const firstTarget = isNumberCell(rows[1][1]) ? rows[1][1].v : null;
    expect(firstTarget).not.toBeNull();
    for (let i = 1; i < rows.length; i++) {
      const cell = rows[i][1];
      expect(isNumberCell(cell)).toBe(true);
      if (isNumberCell(cell)) {
        expect(cell.v).toBe(firstTarget);
      }
    }
  });
});

describe("buildExtraInstallmentSheet", () => {
  it("emits the recomputed installments with parcela desejada + extra derivado columns", () => {
    const rows = buildExtraInstallmentSheet(
      payload({ extraMonthly: 1500, extraStrategy: "installment" }),
    );
    expect(rows[0]).toHaveLength(9);
    expect(isStringCell(rows[0][1]) && rows[0][1].v).toBe("Parcela desejada");
    expect(isStringCell(rows[0][2]) && rows[0][2].v).toBe("Extra derivado");
    expect(rows.length).toBeGreaterThan(2);
    const firstData = rows[1];
    expect(isNumberCell(firstData[2]) && firstData[2].v).toBe(1500);
    expect(isNumberCell(firstData[4]) && firstData[4].v).toBe(1500);
  });
});

describe("buildRentVsBuySheet", () => {
  it("returns a placeholder when rentVsBuy state is null", () => {
    const rows = buildRentVsBuySheet(payload());
    expect(rows.length).toBe(1);
    expect(isStringCell(rows[0][0]) && rows[0][0].v).toMatch(
      /configure os dados de aluguel/i,
    );
  });

  it("emits horizon+1 rows when rentVsBuy is configured", () => {
    const rows = buildRentVsBuySheet(payload({ rentVsBuy: baseRentVsBuy }));
    // 1 header + (horizonMonths + 1) data rows (timeline includes m=0)
    expect(rows.length).toBe(1 + baseRentVsBuy.horizonMonths + 1);
    expect(isStringCell(rows[0][0]) && rows[0][0].v).toBe("Mês");
  });
});

describe("buildComparativeSheet", () => {
  it("renders dashes for extra columns when no extra is configured", () => {
    const rows = buildComparativeSheet(payload());
    const totalRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Total pago",
    );
    expect(totalRow).toBeDefined();
    expect(isStringCell(totalRow![2]) && totalRow![2].v).toBe("—");
    expect(isStringCell(totalRow![3]) && totalRow![3].v).toBe("—");
  });

  it("fills extra columns with reduce-term and reduce-installment summaries", () => {
    const rows = buildComparativeSheet(
      payload({ extraMonthly: 1000, extraStrategy: "term" }),
    );
    const monthsRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Meses reduzidos",
    );
    expect(monthsRow).toBeDefined();
    expect(isNumberCell(monthsRow![1]) && monthsRow![1].v).toBe(0);
    expect(isNumberCell(monthsRow![2])).toBe(true);
    if (isNumberCell(monthsRow![2])) {
      expect(monthsRow![2].v).toBeGreaterThan(0);
    }
  });
});

describe("getExportFilename", () => {
  it("uses the simulacao-financiamento-YYYY-MM-DD.xlsx pattern", () => {
    expect(getExportFilename(new Date(2026, 4, 16))).toBe(
      "simulacao-financiamento-2026-05-16.xlsx",
    );
  });

  it("zero-pads month and day", () => {
    expect(getExportFilename(new Date(2026, 0, 3))).toBe(
      "simulacao-financiamento-2026-01-03.xlsx",
    );
  });
});

describe("SHEET_NAMES", () => {
  it("declares exactly 7 sheets in the documented order", () => {
    expect(SHEET_NAMES).toEqual([
      "Resumo",
      "Premissas",
      "Financiamento Base",
      "Parcela Desejada (Prazo)",
      "Parcela Desejada (Parcela)",
      "Aluguel vs Compra",
      "Tabela Comparativa",
    ]);
  });

  it("respects Excel's 31-char sheet-name limit", () => {
    for (const name of SHEET_NAMES) {
      expect(name.length).toBeLessThanOrEqual(31);
    }
  });
});

describe("exportSimulation", () => {
  const bookNew = vi.fn();
  const aoaToSheet = vi.fn();
  const bookAppendSheet = vi.fn();
  const write = vi.fn();

  beforeEach(() => {
    bookNew.mockReset();
    aoaToSheet.mockReset();
    bookAppendSheet.mockReset();
    write.mockReset();

    const fakeWorkbook = { Sheets: {}, SheetNames: [] };
    bookNew.mockReturnValue(fakeWorkbook);
    aoaToSheet.mockImplementation((aoa: unknown) => ({ aoa }));
    write.mockReturnValue(new Uint8Array([1, 2, 3, 4]).buffer);

    vi.doMock("xlsx", () => ({
      utils: {
        book_new: bookNew,
        aoa_to_sheet: aoaToSheet,
        book_append_sheet: bookAppendSheet,
      },
      write,
    }));

    const createObjectURL = vi.fn(() => "blob:fake-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.doUnmock("xlsx");
    vi.resetModules();
  });

  it("builds 7 sheets in order and triggers a blob download", async () => {
    vi.resetModules();
    const mod = await import("@/lib/export/excel-export");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await mod.exportSimulation(
      payload({ extraMonthly: 1000, rentVsBuy: baseRentVsBuy }),
    );

    expect(bookNew).toHaveBeenCalledTimes(1);
    expect(aoaToSheet).toHaveBeenCalledTimes(7);
    expect(bookAppendSheet).toHaveBeenCalledTimes(7);
    const names = bookAppendSheet.mock.calls.map(
      (call) => call[2] as string,
    );
    expect(names).toEqual([
      "Resumo",
      "Premissas",
      "Financiamento Base",
      "Parcela Desejada (Prazo)",
      "Parcela Desejada (Parcela)",
      "Aluguel vs Compra",
      "Tabela Comparativa",
    ]);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ Sheets: {}, SheetNames: [] }),
      { bookType: "xlsx", type: "array" },
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
  });
});
