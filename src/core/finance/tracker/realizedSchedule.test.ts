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

  // US-012: parcela prevista (scheduledInstallment) deve refletir o impacto
  // dos lançamentos sobre o cronograma — reduzir prazo mantém a parcela,
  // reduzir parcela diminui o valor das parcelas seguintes; pagamentos sem
  // excedente não afetam a curva.
  describe("scheduledInstallment refletindo o modo do lançamento (US-012)", () => {
    const SIX_MONTH_PLAN: TrackerPlanInput = {
      ...PRICE_PLAN,
      termMonths: 6,
    };

    it("reduce_term: parcela prevista permanece a original em todos os meses", () => {
      const { months } = realizedSchedule(
        SIX_MONTH_PLAN,
        entries([1, 500, "reduce_term"]),
      );
      const original = normalSchedule(SIX_MONTH_PLAN)[0]!.installment.toString();
      for (const row of months) {
        expect(row.scheduledInstallment.toString()).toBe(original);
      }
    });

    it("reduce_installment: parcela prevista cai nos meses seguintes ao lançamento", () => {
      const { months } = realizedSchedule(
        SIX_MONTH_PLAN,
        entries([1, 500, "reduce_installment"]),
      );
      const original = normalSchedule(SIX_MONTH_PLAN)[0]!.installment;
      // Mês 1: a parcela prevista é a original (antes da redução).
      expect(months[0]!.scheduledInstallment.equals(original)).toBe(true);
      // Mês 2 em diante: parcelas previstas são estritamente menores e iguais
      // entre si (recalculadas uma vez, mantidas para o resto do prazo).
      const reduced = months[1]!.scheduledInstallment;
      expect(reduced.lessThan(original)).toBe(true);
      for (let i = 2; i < months.length; i++) {
        expect(months[i]!.scheduledInstallment.toString()).toBe(
          reduced.toString(),
        );
      }
      // Garante que a "Parcela prevista" exibida na UI bate com o valor
      // efetivamente pago em meses sem lançamento.
      expect(months[1]!.installment.toString()).toBe(reduced.toString());
    });

    it("pagamento igual à parcela (sem excedente) não altera o cronograma", () => {
      // PRICE: lançar exatamente a parcela vigente em alguns meses não pode
      // alterar o saldo ao fim de cada mês nem a parcela vigente para os
      // meses seguintes — o lançamento não traz amortização extra.
      const original = normalSchedule(SIX_MONTH_PLAN);
      const baseInstallment = original[0]!.installment;
      const { months, paidOffAtMonth } = realizedSchedule(
        SIX_MONTH_PLAN,
        entries(
          [1, baseInstallment.toNumber(), "reduce_installment"],
          [2, baseInstallment.toNumber(), "reduce_term"],
        ),
      );
      expect(paidOffAtMonth).toBe(original.length);
      expect(months).toHaveLength(original.length);
      // Saldo de cada mês deve bater com o cronograma normal (tolerância 1 cent).
      months.forEach((row, i) => {
        expect(
          row.balance.minus(original[i]!.balance).abs().lessThanOrEqualTo(ONE_CENT),
        ).toBe(true);
      });
      // Parcela vigente nos meses sem lançamento (3..penúltimo) continua igual
      // à parcela base do cronograma normal — nenhum recálculo foi disparado.
      for (let i = 2; i < months.length - 1; i++) {
        expect(months[i]!.scheduledInstallment.toString()).toBe(
          baseInstallment.toString(),
        );
      }
    });

    it("pagamento parcial (menor que a parcela) reduz menos o saldo sem disparar recálculo", () => {
      // O usuário paga R$ 50 a menos do que a parcela vigente do mês 1. A UI
      // bloqueia esse cenário na validação, mas o engine não pode quebrar:
      // amortiza só o que foi pago e mantém a parcela vigente nos meses
      // seguintes (sem extra, sem recálculo de PRICE).
      const original = normalSchedule(SIX_MONTH_PLAN);
      const baseInstallment = original[0]!.installment;
      const partial = baseInstallment.toNumber() - 50;
      const { months } = realizedSchedule(
        SIX_MONTH_PLAN,
        entries([1, partial, "reduce_installment"]),
      );
      // Mês 1: parcela vigente preservada; `installment` reflete o pago.
      expect(months[0]!.scheduledInstallment.toString()).toBe(
        baseInstallment.toString(),
      );
      expect(months[0]!.installment.toNumber()).toBeCloseTo(partial, 2);
      // Saldo do mês 1 fica ACIMA do normal (amortizou menos).
      expect(months[0]!.balance.greaterThan(original[0]!.balance)).toBe(true);
      // Saldo continua não-negativo e monotonicamente decrescente.
      for (let i = 0; i < months.length; i++) {
        expect(months[i]!.balance.greaterThanOrEqualTo(0)).toBe(true);
        if (i > 0) {
          expect(
            months[i]!.balance.lessThanOrEqualTo(months[i - 1]!.balance),
          ).toBe(true);
        }
      }
      // Como não houve amortização extra, a parcela vigente do mês 2
      // permanece a original — sem recálculo de PRICE.
      expect(months[1]!.scheduledInstallment.toString()).toBe(
        baseInstallment.toString(),
      );
    });
  });
});
