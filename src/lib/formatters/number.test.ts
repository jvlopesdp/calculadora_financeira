import { describe, it, expect } from "vitest";
import { formatInteger, formatMonths } from "./number";

describe("formatInteger", () => {
  it("formats zero", () => {
    expect(formatInteger(0)).toBe("0");
  });

  it("formats small numbers", () => {
    expect(formatInteger(123)).toBe("123");
  });

  it("uses dot as the thousands separator", () => {
    expect(formatInteger(12345)).toBe("12.345");
  });

  it("formats values in the millions", () => {
    expect(formatInteger(1234567)).toBe("1.234.567");
  });

  it("formats negative values", () => {
    expect(formatInteger(-1234)).toBe("-1.234");
  });

  it("rounds fractional inputs to integer", () => {
    expect(formatInteger(1234.6)).toBe("1.235");
  });
});

describe("formatMonths", () => {
  it("formats zero months", () => {
    expect(formatMonths(0)).toBe("0 meses");
  });

  it("formats one month with singular noun", () => {
    expect(formatMonths(1)).toBe("1 mês");
  });

  it("formats less than a year as months", () => {
    expect(formatMonths(6)).toBe("6 meses");
    expect(formatMonths(11)).toBe("11 meses");
  });

  it("formats exactly one year", () => {
    expect(formatMonths(12)).toBe("1 ano e 0 meses");
  });

  it("formats one year and one month with singular nouns", () => {
    expect(formatMonths(13)).toBe("1 ano e 1 mês");
  });

  it("formats two years exactly", () => {
    expect(formatMonths(24)).toBe("2 anos e 0 meses");
  });

  it("formats ten years exactly", () => {
    expect(formatMonths(120)).toBe("10 anos e 0 meses");
  });

  it("formats years and remaining months", () => {
    expect(formatMonths(125)).toBe("10 anos e 5 meses");
  });

  it("formats a 30-year financing horizon", () => {
    expect(formatMonths(360)).toBe("30 anos e 0 meses");
  });
});
