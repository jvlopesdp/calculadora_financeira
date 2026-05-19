import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { formatBRL, parseBRL } from "./currency";

describe("formatBRL", () => {
  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("formats a small positive number", () => {
    expect(formatBRL(12.34)).toBe("R$ 12,34");
  });

  it("uses dot as the thousands separator", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });

  it("formats values in the millions", () => {
    expect(formatBRL(1234567.89)).toBe("R$ 1.234.567,89");
  });

  it("formats negative values", () => {
    expect(formatBRL(-1234.56)).toBe("-R$ 1.234,56");
  });

  it("rounds fractional precision to 2 decimals", () => {
    expect(formatBRL(123.456)).toBe("R$ 123,46");
    expect(formatBRL(0.999)).toBe("R$ 1,00");
  });

  it("pads when the value has fewer than 2 decimals", () => {
    expect(formatBRL(10)).toBe("R$ 10,00");
    expect(formatBRL(10.1)).toBe("R$ 10,10");
  });

  it("accepts Decimal instances", () => {
    expect(formatBRL(new Decimal("1234.56"))).toBe("R$ 1.234,56");
    expect(formatBRL(new Decimal("0"))).toBe("R$ 0,00");
    expect(formatBRL(new Decimal("-99.9"))).toBe("-R$ 99,90");
  });

  it("handles very large Decimal values precisely", () => {
    expect(formatBRL(new Decimal("9999999.99"))).toBe("R$ 9.999.999,99");
  });
});

describe("parseBRL", () => {
  it("parses canonical BRL output", () => {
    expect(parseBRL("R$ 1.234,56")).toBeCloseTo(1234.56);
  });

  it("parses values without the R$ prefix", () => {
    expect(parseBRL("1.234,56")).toBeCloseTo(1234.56);
    expect(parseBRL("1234,56")).toBeCloseTo(1234.56);
  });

  it("round-trips formatBRL output", () => {
    const original = 9876.54;
    expect(parseBRL(formatBRL(original))).toBeCloseTo(original);
  });

  it("returns null for blanks", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("R$ -")).toBeNull();
  });

  it("parses integer values", () => {
    expect(parseBRL("R$ 0,00")).toBe(0);
    expect(parseBRL("10")).toBe(10);
  });
});
