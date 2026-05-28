import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { goalSchedule } from "./goalSchedule";
import { normalSchedule, type TrackerPlanInput } from "./normalSchedule";

/** Plano de teste: R$ 1.000 @ 10% a.m., 3 meses. Parcela PRICE = 402.11. */
const PRICE_PLAN: TrackerPlanInput = {
  principal: new Decimal(1000),
  monthlyRate: new Decimal("0.1"),
  termMonths: 3,
  modality: "PRICE",
};

const SAC_PLAN: TrackerPlanInput = { ...PRICE_PLAN, modality: "SAC" };

const BIG_PLAN: TrackerPlanInput = {
  principal: new Decimal(300000),
  monthlyRate: new Decimal("0.008"),
  termMonths: 360,
  modality: "PRICE",
};

describe("goalSchedule", () => {
  describe("meta = parcela (PRICE) == normalSchedule", () => {
    it("reproduz o cronograma normal linha a linha", () => {
      const installment = normalSchedule(PRICE_PLAN)[0]!.installment;
      const { months, paidOffAtMonth, invalidAtMonth } = goalSchedule(
        PRICE_PLAN,
        installment,
      );
      const normal = normalSchedule(PRICE_PLAN);

      expect(invalidAtMonth).toBeNull();
      expect(paidOffAtMonth).toBe(3);
      expect(months).toHaveLength(normal.length);
      months.forEach((row, i) => {
        const ref = normal[i]!;
        expect(row.monthIndex).toBe(ref.monthIndex);
        expect(row.installment.toString()).toBe(ref.installment.toString());
        expect(row.interest.toString()).toBe(ref.interest.toString());
        expect(row.amortization.toString()).toBe(ref.amortization.toString());
        expect(row.balance.toString()).toBe(ref.balance.toString());
      });
    });

    it("também reproduz o cronograma normal no fixture longo (300k/0.8%/360)", () => {
      const installment = normalSchedule(BIG_PLAN)[0]!.installment;
      const { months, paidOffAtMonth } = goalSchedule(BIG_PLAN, installment);
      const normal = normalSchedule(BIG_PLAN);

      expect(paidOffAtMonth).toBe(360);
      expect(months).toHaveLength(normal.length);
      months.forEach((row, i) => {
        expect(row.balance.toString()).toBe(normal[i]!.balance.toString());
        expect(row.installment.toString()).toBe(normal[i]!.installment.toString());
      });
    });
  });

  describe("meta > parcela encurta o prazo", () => {
    it("paga sempre a meta, amortiza o excedente e quita antes do prazo", () => {
      const { months, paidOffAtMonth, invalidAtMonth } = goalSchedule(
        PRICE_PLAN,
        new Decimal(600),
      );

      expect(invalidAtMonth).toBeNull();
      expect(paidOffAtMonth).toBe(2);
      expect(months).toHaveLength(2);
      expect(months[0]!.installment.toString()).toBe("600");
      expect(months[0]!.balance.toString()).toBe("500");
      expect(months[months.length - 1]!.balance.equals(0)).toBe(true);
    });

    it("encurta substancialmente o fixture longo", () => {
      const { months, paidOffAtMonth } = goalSchedule(BIG_PLAN, new Decimal(5000));
      expect(paidOffAtMonth).not.toBeNull();
      expect(paidOffAtMonth!).toBeLessThan(360);
      expect(months[months.length - 1]!.balance.equals(0)).toBe(true);
      // saldo monotonicamente decrescente
      for (let i = 1; i < months.length; i++) {
        expect(months[i]!.balance.lessThanOrEqualTo(months[i - 1]!.balance)).toBe(true);
      }
    });
  });

  describe("meta < parcela é inviável", () => {
    it("retorna invalidAtMonth = 1 e não inventa pagamento (PRICE)", () => {
      const { months, paidOffAtMonth, invalidAtMonth } = goalSchedule(
        PRICE_PLAN,
        new Decimal(300),
      );
      expect(invalidAtMonth).toBe(1);
      expect(paidOffAtMonth).toBeNull();
      expect(months).toHaveLength(0);
    });

    it("retorna invalidAtMonth = 1 mesmo se a meta seria válida em meses futuros (SAC)", () => {
      // 1ª parcela SAC = 433.33; meses seguintes são menores, mas paramos no mês 1.
      const { months, invalidAtMonth } = goalSchedule(SAC_PLAN, new Decimal(400));
      expect(invalidAtMonth).toBe(1);
      expect(months).toHaveLength(0);
    });
  });

  describe("meta que zera o saldo cedo", () => {
    it("quita no próprio mês quando a meta >= dívida total e trunca", () => {
      const { months, paidOffAtMonth } = goalSchedule(PRICE_PLAN, new Decimal(1100));
      expect(paidOffAtMonth).toBe(1);
      expect(months).toHaveLength(1);
      expect(months[0]!.installment.toString()).toBe("1100");
      expect(months[0]!.amortization.toString()).toBe("1000");
      expect(months[0]!.balance.equals(0)).toBe(true);
    });
  });

  describe("SAC com meta acima da primeira parcela", () => {
    it("encurta o prazo e zera o saldo", () => {
      const { months, paidOffAtMonth, invalidAtMonth } = goalSchedule(
        SAC_PLAN,
        new Decimal(600),
      );
      expect(invalidAtMonth).toBeNull();
      expect(paidOffAtMonth).toBe(2);
      expect(months[0]!.installment.toString()).toBe("600");
      expect(months[0]!.balance.toString()).toBe("500");
      expect(months[months.length - 1]!.balance.equals(0)).toBe(true);
    });
  });

  describe("termMonths <= 0", () => {
    it("retorna vazio sem paidOff/invalid", () => {
      const result = goalSchedule({ ...PRICE_PLAN, termMonths: 0 }, new Decimal(600));
      expect(result.months).toHaveLength(0);
      expect(result.paidOffAtMonth).toBeNull();
      expect(result.invalidAtMonth).toBeNull();
    });
  });
});
