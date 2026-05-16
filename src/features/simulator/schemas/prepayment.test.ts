import { describe, expect, it } from "vitest";
import { prepaymentSchema } from "./prepayment";

function firstErrorFor(
  result: ReturnType<typeof prepaymentSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)
    ?.message;
}

describe("prepaymentSchema", () => {
  describe("extraMonthly", () => {
    it("accepts zero (empty-state passthrough)", () => {
      const result = prepaymentSchema.safeParse({ extraMonthly: 0 });
      expect(result.success).toBe(true);
    });

    it("accepts a positive amount", () => {
      const result = prepaymentSchema.safeParse({ extraMonthly: 500 });
      expect(result.success).toBe(true);
    });

    it("rejects negative values", () => {
      const result = prepaymentSchema.safeParse({ extraMonthly: -1 });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "extraMonthly")).toBe(
        "O pagamento extra não pode ser negativo",
      );
    });

    it("rejects non-numeric input with pt-BR message", () => {
      const result = prepaymentSchema.safeParse({ extraMonthly: "abc" });
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "extraMonthly")).toBe(
        "O pagamento extra deve ser um número",
      );
    });

    it("rejects missing values", () => {
      const result = prepaymentSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(firstErrorFor(result, "extraMonthly")).toBe(
        "Informe o valor do pagamento extra",
      );
    });
  });
});
