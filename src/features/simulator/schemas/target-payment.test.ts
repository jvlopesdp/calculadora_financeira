import { describe, expect, it } from "vitest";
import { targetPaymentSchema } from "./target-payment";

function firstErrorFor(
  result: ReturnType<typeof targetPaymentSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)
    ?.message;
}

describe("targetPaymentSchema", () => {
  describe("target", () => {
    it("accepts a positive amount", () => {
      const result = targetPaymentSchema.safeParse({ target: 3500 });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = targetPaymentSchema.safeParse({ target: 0 });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "target")).toBe(
        "A parcela desejada deve ser maior que zero",
      );
    });

    it("rejects negative values", () => {
      const result = targetPaymentSchema.safeParse({ target: -100 });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "target")).toBe(
        "A parcela desejada deve ser maior que zero",
      );
    });

    it("rejects non-numeric input with pt-BR message", () => {
      const result = targetPaymentSchema.safeParse({ target: "abc" });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "target")).toBe(
        "A parcela desejada deve ser um número",
      );
    });

    it("rejects missing values with pt-BR message", () => {
      const result = targetPaymentSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "target")).toBe(
        "Informe a parcela mensal desejada",
      );
    });

    it("rejects non-finite values", () => {
      const result = targetPaymentSchema.safeParse({
        target: Number.POSITIVE_INFINITY,
      });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "target")).toBe(
        "A parcela desejada deve ser um número válido",
      );
    });
  });
});
