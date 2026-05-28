import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { normalSchedule, type TrackerPlanInput } from "./normalSchedule";
import { realizedSchedule, type RealizedEntry } from "./realizedSchedule";

const ONE_CENT = new Decimal("0.01");

/** Plano de teste: R$ 1.000 @ 10% a.m., 3 meses. Parcela PRICE = 402.11. */
const PRICE_PLAN: TrackerPlanInput = {
  principal: new Decimal(1000),
  monthlyRate: new Decimal("0.1"),
  termMonths: 3,
  modality: "PRICE",
};

const SAC_PLAN: TrackerPlanInput = { ...PRICE_PLAN, modality: "SAC" };

function entries(
  ...pairs: Array<[number, number, RealizedEntry["applyMode"]]>
): Map<number, RealizedEntry> {
  const map = new Map<number, RealizedEntry>();
  for (const [month, amount, applyMode] of pairs) {
    map.set(month, { paidAmount: new Decimal(amount), applyMode });
  }
  return map;
}

describe("realizedSchedule", () => {
  describe("sem lançamentos == normalSchedule", () => {
    const big: TrackerPlanInput = {
      principal: new Decimal(300000),
      monthlyRate: new Decimal("0.008"),
      termMonths: 360,
      modality: "PRICE",
    };

    it("PRICE: cada linha bate com normalSchedule", () => {
      const normal = normalSchedule(big);
      const { months, paidOffAtMonth } = realizedSchedule(big, new Map());
      expect(months).toHaveLength(normal.length);
      expect(paidOffAtMonth).toBe(360);
      months.forEach((row, i) => {
        const ref = normal[i]!;
        expect(row.monthIndex).toBe(ref.monthIndex);
        expect(row.installment.toString()).toBe(ref.installment.toString());
        expect(row.interest.toString()).toBe(ref.interest.toString());
        expect(row.amortization.toString()).toBe(ref.amortization.toString());
        expect(row.balance.toString()).toBe(ref.balance.toString());
      });
    });

    it("SAC: cada linha bate com normalSchedule", () => {
      const sac: TrackerPlanInput = { ...big, modality: "SAC" };
      const normal = normalSchedule(sac);
      const { months } = realizedSchedule(sac, new Map());
      expect(months).toHaveLength(normal.length);
      months.forEach((row, i) => {
        expect(row.balance.toString()).toBe(normal[i]!.balance.toString());
        expect(row.installment.toString()).toBe(normal[i]!.installment.toString());
      });
    });
  });

  describe("entry maior que a parcela com reduce_term", () => {
    const { months, paidOffAtMonth } = realizedSchedule(
      PRICE_PLAN,
      entries([1, 902.11, "reduce_term"]),
    );

    it("mantém a parcela e quita antes do prazo", () => {
      expect(paidOffAtMonth).toBe(2);
      expect(months).toHaveLength(2);
      expect(months[0]!.installment.toString()).toBe("902.11");
      expect(months[0]!.balance.toString()).toBe("197.89");
      // mês 2 sem entry usa a parcela original (não recalculada) e quita o saldo
      expect(months[1]!.interest.toString()).toBe("19.79");
      expect(months[1]!.amortization.toString()).toBe("197.89");
      expect(months[1]!.balance.toString()).toBe("0");
    });
  });

  describe("entry maior que a parcela com reduce_installment", () => {
    const { months, paidOffAtMonth } = realizedSchedule(
      PRICE_PLAN,
      entries([1, 902.11, "reduce_installment"]),
    );

    it("mantém o prazo e reduz as parcelas seguintes", () => {
      expect(paidOffAtMonth).toBe(3);
      expect(months).toHaveLength(3);
      expect(months[0]!.installment.toString()).toBe("902.11");
      expect(months[0]!.balance.toString()).toBe("197.89");
      // parcela recalculada (< 402.11 original) e reaproveitada no mês 2 sem entry
      expect(months[1]!.installment.toString()).toBe("114.02");
      expect(months[1]!.balance.toString()).toBe("103.66");
      expect(months[2]!.balance.toString()).toBe("0");
    });
  });

  describe("mês sem entry após uma redução usa a parcela vigente", () => {
    it("a parcela do mês 2 é a recalculada, não a original", () => {
      const { months } = realizedSchedule(
        PRICE_PLAN,
        entries([1, 902.11, "reduce_installment"]),
      );
      const original = normalSchedule(PRICE_PLAN)[0]!.installment;
      expect(months[1]!.installment.lessThan(original)).toBe(true);
      expect(months[1]!.installment.toString()).toBe("114.02");
    });
  });

  describe("sequência alternando modes", () => {
    const { months, paidOffAtMonth } = realizedSchedule(
      { ...PRICE_PLAN, termMonths: 6 },
      entries(
        [1, 500, "reduce_installment"],
        [2, 400, "reduce_term"],
      ),
    );

    it("saldo é monotonicamente decrescente e zera ao quitar", () => {
      expect(paidOffAtMonth).not.toBeNull();
      expect(paidOffAtMonth).toBe(months[months.length - 1]!.monthIndex);
      for (let i = 1; i < months.length; i++) {
        expect(
          months[i]!.balance.lessThanOrEqualTo(months[i - 1]!.balance),
        ).toBe(true);
      }
      expect(months[months.length - 1]!.balance.equals(0)).toBe(true);
    });
  });

  describe("sequência que zera o saldo cedo", () => {
    it("um pagamento >= dívida total quita no próprio mês e trunca", () => {
      const { months, paidOffAtMonth } = realizedSchedule(
        PRICE_PLAN,
        entries([1, 1100, "reduce_term"]),
      );
      expect(paidOffAtMonth).toBe(1);
      expect(months).toHaveLength(1);
      expect(months[0]!.installment.toString()).toBe("1100");
      expect(months[0]!.amortization.toString()).toBe("1000");
      expect(months[0]!.balance.equals(0)).toBe(true);
    });
  });

  describe("SAC com reduce_term", () => {
    it("mantém a amortização base e quita no prazo com saldo zero", () => {
      const { months, paidOffAtMonth } = realizedSchedule(
        SAC_PLAN,
        entries([1, 633.33, "reduce_term"]),
      );
      expect(paidOffAtMonth).toBe(3);
      expect(months[0]!.installment.toString()).toBe("633.33");
      expect(months[0]!.balance.toString()).toBe("466.67");
      expect(months[months.length - 1]!.balance.abs().lessThanOrEqualTo(ONE_CENT)).toBe(true);
    });
  });

  describe("termMonths <= 0", () => {
    it("retorna vazio", () => {
      const result = realizedSchedule({ ...PRICE_PLAN, termMonths: 0 }, new Map());
      expect(result.months).toHaveLength(0);
      expect(result.paidOffAtMonth).toBeNull();
    });
  });
});
