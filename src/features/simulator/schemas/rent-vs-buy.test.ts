import { describe, expect, it } from "vitest";
import { rentVsBuySchema } from "./rent-vs-buy";

const baseValid = {
  monthlyRent: 2_500,
  annualRentAdjustment: 0.05,
  annualInvestmentReturn: 0.1,
  annualAppreciation: 0.06,
  monthlyOwnershipCosts: 800,
  horizonMonths: 360,
};

function firstErrorFor(
  result: ReturnType<typeof rentVsBuySchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)
    ?.message;
}

describe("rentVsBuySchema", () => {
  it("accepts a fully valid input", () => {
    const result = rentVsBuySchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  describe("monthlyRent", () => {
    it("accepts zero (no rent baseline)", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        monthlyRent: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative rent", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        monthlyRent: -10,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "monthlyRent")).toBe(
        "O aluguel mensal não pode ser negativo",
      );
    });
  });

  describe("annualRentAdjustment", () => {
    it("accepts zero", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualRentAdjustment: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative adjustment", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualRentAdjustment: -0.01,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "annualRentAdjustment")).toBe(
        "O reajuste anual do aluguel não pode ser negativo",
      );
    });
  });

  describe("annualInvestmentReturn", () => {
    it("accepts zero", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualInvestmentReturn: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative return", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualInvestmentReturn: -0.01,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "annualInvestmentReturn")).toBe(
        "O rendimento anual do investimento não pode ser negativo",
      );
    });
  });

  describe("annualAppreciation", () => {
    it("accepts zero", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualAppreciation: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative appreciation", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        annualAppreciation: -0.01,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "annualAppreciation")).toBe(
        "A valorização anual do imóvel não pode ser negativa",
      );
    });
  });

  describe("monthlyOwnershipCosts", () => {
    it("accepts zero", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        monthlyOwnershipCosts: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative ownership costs", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        monthlyOwnershipCosts: -1,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "monthlyOwnershipCosts")).toBe(
        "Os custos mensais de propriedade não podem ser negativos",
      );
    });
  });

  describe("horizonMonths", () => {
    it("accepts a positive integer", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        horizonMonths: 240,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        horizonMonths: 0,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "horizonMonths")).toBe(
        "O horizonte deve ser maior que zero",
      );
    });

    it("rejects negative values", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        horizonMonths: -12,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "horizonMonths")).toBe(
        "O horizonte deve ser maior que zero",
      );
    });

    it("rejects non-integer values", () => {
      const result = rentVsBuySchema.safeParse({
        ...baseValid,
        horizonMonths: 60.5,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "horizonMonths")).toBe(
        "O horizonte deve ser um número inteiro de meses",
      );
    });
  });
});
