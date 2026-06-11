import { describe, expect, it } from "vitest";

import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import { buildTrackerKpis } from "@/features/acompanhamento/lib/build-tracker-kpis";
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
    target_monthly_total_cents: 10_000_00,
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

describe("buildTrackerKpis", () => {
  it("returns six placeholders with the empty-state hint when there are no entries", () => {
    const curves = buildCurves(makePlan(), []);
    const kpis = buildTrackerKpis(curves);

    expect(kpis).toHaveLength(6);
    expect(kpis.map((k) => k.title)).toEqual([
      "% já pago",
      "Saldo devedor",
      "Parcelas restantes",
      "Juros pagos até agora",
      "Economia vs cronograma original",
      "Prazo reduzido",
    ]);
    for (const kpi of kpis) {
      expect(kpi.value).toBe("—");
      expect(kpi.hint).toMatch(/Registre lançamentos/);
    }
  });

  it("computes the six KPIs from realized vs normal curves once entries exist", () => {
    // 12-month plan, 12% a.a. principal R$100,000. Pay one full installment so
    // "% pago" > 0 and the realized curve still has remaining months.
    const curves = buildCurves(
      makePlan(),
      [makeEntry(1, { paid_amount_cents: 8_884_88 })], // ~PRICE installment.
    );
    const kpis = buildTrackerKpis(curves);

    expect(kpis).toHaveLength(6);

    const byTitle = new Map(kpis.map((k) => [k.title, k]));

    expect(byTitle.get("% já pago")!.value).toMatch(/%$/);
    expect(byTitle.get("Saldo devedor")!.value).toMatch(/^R\$/);
    const remaining = Number(byTitle.get("Parcelas restantes")!.value);
    expect(Number.isFinite(remaining)).toBe(true);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(12);
    expect(byTitle.get("Juros pagos até agora")!.value).toMatch(/^R\$/);
    expect(byTitle.get("Economia vs cronograma original")!.value).toMatch(
      /^R\$/,
    );
    expect(byTitle.get("Prazo reduzido")!.value).toMatch(/m[êe]s/);
  });

  it("flags an upward trend on economia and prazo when extra payments cut the term", () => {
    // 3 full extra payments → realized term shorter than normal, total interest lower.
    const curves = buildCurves(
      makePlan(),
      [
        makeEntry(1, { paid_amount_cents: 20_000_00 }),
        makeEntry(2, { paid_amount_cents: 20_000_00 }),
        makeEntry(3, { paid_amount_cents: 20_000_00 }),
      ],
    );
    const kpis = buildTrackerKpis(curves);
    const byTitle = new Map(kpis.map((k) => [k.title, k]));

    expect(byTitle.get("Economia vs cronograma original")!.trend).toBe("up");
    expect(byTitle.get("Prazo reduzido")!.trend).toBe("up");
    // "% já pago" should also be positive (and trending up).
    expect(byTitle.get("% já pago")!.trend).toBe("up");
  });

  it("clamps '% já pago' at 100% and 'Parcelas restantes' at 0 once the loan is paid off", () => {
    // Pay the entire balance plus interest in month 1.
    const curves = buildCurves(
      makePlan(),
      [makeEntry(1, { paid_amount_cents: 200_000_00 })],
    );
    const kpis = buildTrackerKpis(curves);
    const byTitle = new Map(kpis.map((k) => [k.title, k]));

    expect(byTitle.get("% já pago")!.value).toMatch(/100,0%/);
    expect(byTitle.get("Parcelas restantes")!.value).toBe("0");
    expect(byTitle.get("Saldo devedor")!.value).toMatch(/R\$\s*0,00/);
  });
});
