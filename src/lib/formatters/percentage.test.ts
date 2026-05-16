import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { formatPercentage, parsePercentage } from "./percentage";

describe("formatPercentage", () => {
  it("formats zero with default 2 decimals", () => {
    expect(formatPercentage(0)).toBe("0,00%");
  });

  it("formats a small percentage", () => {
    expect(formatPercentage(1.25)).toBe("1,25%");
  });

  it("formats one hundred", () => {
    expect(formatPercentage(100)).toBe("100,00%");
  });

  it("respects a custom decimal count", () => {
    expect(formatPercentage(1.234, 4)).toBe("1,2340%");
    expect(formatPercentage(1.5, 0)).toBe("2%");
  });

  it("formats negative percentages", () => {
    expect(formatPercentage(-1.25)).toBe("-1,25%");
  });

  it("accepts Decimal instances", () => {
    expect(formatPercentage(new Decimal("8.75"))).toBe("8,75%");
  });

  it("formats large percentages with thousand separator", () => {
    expect(formatPercentage(1234.56)).toBe("1.234,56%");
  });
});

describe("parsePercentage", () => {
  it("parses a value with the percent sign", () => {
    expect(parsePercentage("1,25%").toNumber()).toBe(1.25);
  });

  it("parses a value without the percent sign", () => {
    expect(parsePercentage("1,25").toNumber()).toBe(1.25);
  });

  it("parses a value with thousand separators", () => {
    expect(parsePercentage("1.234,56%").toNumber()).toBe(1234.56);
  });

  it("parses zero", () => {
    expect(parsePercentage("0%").toNumber()).toBe(0);
  });

  it("ignores whitespace", () => {
    expect(parsePercentage(" 1,25 % ").toNumber()).toBe(1.25);
  });

  it("returns Decimal instances", () => {
    expect(parsePercentage("1,25%")).toBeInstanceOf(Decimal);
  });
});

describe("percentage round-trip", () => {
  it("formatPercentage then parsePercentage recovers the value", () => {
    const samples = [0, 1.25, 8.75, 12.5, 100, 0.01, 1234.56];
    for (const x of samples) {
      const formatted = formatPercentage(x);
      const parsed = parsePercentage(formatted);
      expect(parsed.toNumber()).toBeCloseTo(x, 2);
    }
  });
});
