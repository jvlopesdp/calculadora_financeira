import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TRACKER_SHEET_NAMES,
  buildComparativoSheet,
  buildCronogramaMetaSheet,
  buildCronogramaNormalSheet,
  buildCronogramaRealizadoSheet,
  buildLancamentosSheet,
  buildPlanoSheet,
  getTrackerExportFilename,
  type ExportCell,
} from "@/features/acompanhamento/lib/export-tracker";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Apartamento Centro",
    property_value_cents: 100_000_00,
    down_payment_cents: 0,
    term_months: 12,
    annual_rate_bp: 1200,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 20_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function makeEntry(
  monthIndex: number,
  overrides: Partial<TrackerEntryApi> = {},
): TrackerEntryApi {
  return {
    id: `entry_${monthIndex}`,
    plan_id: "tp_1",
    month_index: monthIndex,
    paid_amount_cents: 10_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
    ...overrides,
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

describe("TRACKER_SHEET_NAMES", () => {
  it("declares exactly 6 sheets in the documented order", () => {
    expect(TRACKER_SHEET_NAMES).toEqual([
      "Plano",
      "Lançamentos",
      "Cronograma Realizado",
      "Cronograma Normal",
      "Cronograma Meta",
      "Comparativo",
    ]);
  });

  it("respects Excel's 31-char sheet-name limit", () => {
    for (const name of TRACKER_SHEET_NAMES) {
      expect(name.length).toBeLessThanOrEqual(31);
    }
  });
});

describe("buildPlanoSheet", () => {
  it("lists the plan fields with currency/percent formats", () => {
    const labels = firstColumn(buildPlanoSheet(makePlan()));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Nome",
        "Valor do imóvel",
        "Valor financiado",
        "Sistema de amortização",
        "Taxa anual",
        "Prazo (meses)",
        "Data de início",
        "Valor mensal-meta",
      ]),
    );

    const rows = buildPlanoSheet(makePlan());
    const propertyRow = rows.find(
      (r) => isStringCell(r[0]) && r[0].v === "Valor do imóvel",
    );
    const propertyCell = propertyRow?.[1];
    expect(isNumberCell(propertyCell!)).toBe(true);
    if (!isNumberCell(propertyCell!)) throw new Error("expected number");
    expect(propertyCell.v).toBe(100_000);
  });
});

describe("buildLancamentosSheet", () => {
  it("emits a placeholder row when there are no entries", () => {
    const rows = buildLancamentosSheet(makePlan(), []);
    expect(rows).toHaveLength(2);
    expect(isStringCell(rows[1][0]) && rows[1][0].v).toMatch(
      /nenhum lançamento/i,
    );
  });

  it("emits one row per entry, sorted by month, with a BR due date", () => {
    const rows = buildLancamentosSheet(makePlan(), [
      makeEntry(3),
      makeEntry(1),
    ]);
    // header + 2 data rows
    expect(rows).toHaveLength(3);
    expect(isNumberCell(rows[1][0]) && rows[1][0].v).toBe(1);
    expect(isNumberCell(rows[2][0]) && rows[2][0].v).toBe(3);
    // month 1 → start_date + 0 months = 01/01/2025
    expect(isStringCell(rows[1][1]) && rows[1][1].v).toBe("01/01/2025");
    expect(isStringCell(rows[1][3]) && rows[1][3].v).toBe("Reduzir prazo");
  });
});

describe("schedule sheets", () => {
  it("Cronograma Normal has one row per term month plus a header", () => {
    const plan = makePlan();
    const curves = buildCurves(plan, []);
    const rows = buildCronogramaNormalSheet(curves, plan);
    expect(rows.length).toBe(plan.term_months + 1);
    // Normal goes the full term — no early "Quitado" filler rows.
    const statuses = rows
      .slice(1)
      .map((r) => (isStringCell(r[6]) ? r[6].v : ""));
    expect(statuses).not.toContain("Quitado");
  });

  it("Cronograma Realizado marks post-payoff rows as Quitado with zero balance", () => {
    const plan = makePlan();
    // A huge month-1 payment (reduce_term) pays the loan off well before term.
    const curves = buildCurves(plan, [
      makeEntry(1, { paid_amount_cents: 95_000_00 }),
    ]);
    const rows = buildCronogramaRealizadoSheet(curves, plan);
    expect(rows.length).toBe(plan.term_months + 1);

    const quitadoRows = rows
      .slice(1)
      .filter((r) => isStringCell(r[6]) && r[6].v === "Quitado");
    expect(quitadoRows.length).toBeGreaterThan(0);
    for (const row of quitadoRows) {
      // Parcela (idx 2) and Saldo devedor (idx 5) are zeroed out.
      expect(isNumberCell(row[2]) && row[2].v).toBe(0);
      expect(isNumberCell(row[5]) && row[5].v).toBe(0);
    }
  });

  it("Cronograma Meta shows an explanatory note when the target is below the installment", () => {
    const plan = makePlan({ target_monthly_total_cents: 1_000_00 });
    const curves = buildCurves(plan, []);
    const rows = buildCronogramaMetaSheet(curves, plan);
    expect(rows).toHaveLength(2);
    expect(isStringCell(rows[1][0]) && rows[1][0].v).toMatch(
      /menor que a parcela inicial/i,
    );
  });
});

describe("buildComparativoSheet", () => {
  it("emits exactly term_months data rows of the three balances side by side", () => {
    const plan = makePlan();
    const curves = buildCurves(plan, [makeEntry(1), makeEntry(2)]);
    const rows = buildComparativoSheet(curves, plan);

    // One header row + term_months data rows.
    expect(rows).toHaveLength(plan.term_months + 1);
    expect(rows.length - 1).toBe(plan.term_months);

    expect(isStringCell(rows[0][2]) && rows[0][2].v).toBe("Saldo Realizado");
    expect(isStringCell(rows[0][3]) && rows[0][3].v).toBe("Saldo Normal");
    expect(isStringCell(rows[0][4]) && rows[0][4].v).toBe("Saldo Meta");

    // Last month's Normal balance settles to ~0.
    const lastRow = rows[rows.length - 1];
    expect(isNumberCell(lastRow[3]) && lastRow[3].v).toBeCloseTo(0, 2);
  });

  it("renders '—' for the Meta column when the meta plan is invalid", () => {
    const plan = makePlan({ target_monthly_total_cents: 1_000_00 });
    const curves = buildCurves(plan, []);
    const rows = buildComparativoSheet(curves, plan);
    const firstData = rows[1];
    expect(isStringCell(firstData[4]) && firstData[4].v).toBe("—");
  });
});

describe("getTrackerExportFilename", () => {
  it("slugifies the plan name and appends the date", () => {
    expect(getTrackerExportFilename("Apartamento Centro", new Date(2026, 4, 16)))
      .toBe("acompanhamento-apartamento-centro-2026-05-16.xlsx");
  });

  it("zero-pads month and day", () => {
    expect(getTrackerExportFilename("Plano", new Date(2026, 0, 3))).toBe(
      "acompanhamento-plano-2026-01-03.xlsx",
    );
  });

  it("falls back to a bare name when the slug is empty", () => {
    expect(getTrackerExportFilename("!!!", new Date(2026, 0, 3))).toBe(
      "acompanhamento-2026-01-03.xlsx",
    );
  });
});

describe("exportTracker", () => {
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

  it("builds 6 sheets in order and triggers a blob download", async () => {
    vi.resetModules();
    const mod = await import("@/features/acompanhamento/lib/export-tracker");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await mod.exportTracker(makePlan(), [makeEntry(1), makeEntry(2)]);

    expect(bookNew).toHaveBeenCalledTimes(1);
    expect(aoaToSheet).toHaveBeenCalledTimes(6);
    expect(bookAppendSheet).toHaveBeenCalledTimes(6);
    const names = bookAppendSheet.mock.calls.map((call) => call[2] as string);
    expect(names).toEqual([
      "Plano",
      "Lançamentos",
      "Cronograma Realizado",
      "Cronograma Normal",
      "Cronograma Meta",
      "Comparativo",
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
