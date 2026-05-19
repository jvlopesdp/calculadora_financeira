import { describe, expect, it } from "vitest";
import { financingSchema } from "./financing";

const baseValid = {
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  monthlyRate: 0.008,
  system: "PRICE" as const,
};

function firstErrorFor(
  result: ReturnType<typeof financingSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)
    ?.message;
}

describe("financingSchema", () => {
  it("accepts a fully valid input (PRICE)", () => {
    const result = financingSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("accepts SAC as a valid amortization system", () => {
    const result = financingSchema.safeParse({ ...baseValid, system: "SAC" });
    expect(result.success).toBe(true);
  });

  describe("propertyValue", () => {
    it("rejects zero", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        propertyValue: 0,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "propertyValue")).toBe(
        "O valor do imóvel deve ser maior que zero",
      );
    });

    it("rejects negative values", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        propertyValue: -10,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "propertyValue")).toBe(
        "O valor do imóvel deve ser maior que zero",
      );
    });

    it("rejects non-numeric input with pt-BR message", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        propertyValue: "abc",
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "propertyValue")).toBe(
        "O valor do imóvel deve ser um número",
      );
    });

    it("rejects missing values", () => {
      const { propertyValue: _omit, ...rest } = baseValid;
      void _omit;
      const result = financingSchema.safeParse(rest);
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "propertyValue")).toBe(
        "Informe o valor do imóvel",
      );
    });
  });

  describe("downPayment", () => {
    it("accepts zero (no down payment)", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        downPayment: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative values", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        downPayment: -1,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "downPayment")).toBe(
        "A entrada não pode ser negativa",
      );
    });

    it("rejects down payment equal to property value", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        downPayment: baseValid.propertyValue,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "downPayment")).toBe(
        "A entrada deve ser menor que o valor do imóvel",
      );
    });

    it("rejects down payment greater than property value", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        downPayment: baseValid.propertyValue + 1,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "downPayment")).toBe(
        "A entrada deve ser menor que o valor do imóvel",
      );
    });
  });

  describe("termMonths", () => {
    it("accepts a positive integer", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        termMonths: 120,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        termMonths: 0,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "termMonths")).toBe(
        "O prazo deve ser maior que zero",
      );
    });

    it("rejects negative values", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        termMonths: -12,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "termMonths")).toBe(
        "O prazo deve ser maior que zero",
      );
    });

    it("rejects non-integer values", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        termMonths: 360.5,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "termMonths")).toBe(
        "O prazo deve ser um número inteiro de meses",
      );
    });
  });

  describe("monthlyRate", () => {
    it("accepts a positive rate", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        monthlyRate: 0.01,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        monthlyRate: 0,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "monthlyRate")).toBe(
        "A taxa mensal deve ser maior que zero",
      );
    });

    it("rejects negative rates", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        monthlyRate: -0.001,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "monthlyRate")).toBe(
        "A taxa mensal deve ser maior que zero",
      );
    });
  });

  describe("system", () => {
    it("rejects unknown amortization systems", () => {
      const result = financingSchema.safeParse({
        ...baseValid,
        system: "FRENCH",
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "system")).toBeDefined();
    });

    it("rejects missing amortization system", () => {
      const { system: _omit, ...rest } = baseValid;
      void _omit;
      const result = financingSchema.safeParse(rest);
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "system")).toBeDefined();
    });
  });
});
