import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CurrencyInput } from "@/components/finance/currency-input";
import { parseBRL } from "@/lib/formatters/currency";

function Harness({
  initial = null,
  onChange,
}: {
  initial?: number | null;
  onChange?: (v: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <CurrencyInput
      data-testid="currency"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("parseBRL", () => {
  it("parses BRL-formatted strings", () => {
    expect(parseBRL("R$ 1.234,56")).toBeCloseTo(1234.56);
    expect(parseBRL("1.234,56")).toBeCloseTo(1234.56);
    expect(parseBRL("1234,56")).toBeCloseTo(1234.56);
    expect(parseBRL("0")).toBe(0);
  });

  it("returns null for blanks and invalid input", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
  });

  it("handles NBSP that Intl currency formatter emits", () => {
    const nbsp = "R$ 1.234,56";
    expect(parseBRL(nbsp)).toBeCloseTo(1234.56);
  });
});

describe("CurrencyInput", () => {
  it("renders the initial value formatted as BRL", () => {
    render(<Harness initial={1234.56} />);
    const input = screen.getByTestId("currency") as HTMLInputElement;
    expect(input.value).toBe("R$ 1.234,56");
  });

  it("calls onChange with parsed number on each keystroke", () => {
    const handle = vi.fn();
    render(<Harness onChange={handle} />);
    const input = screen.getByTestId("currency");
    fireEvent.change(input, { target: { value: "1.234,56" } });
    expect(handle).toHaveBeenLastCalledWith(1234.56);
  });

  it("reformats to BRL on blur", () => {
    render(<Harness initial={null} />);
    const input = screen.getByTestId("currency") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9876,5" } });
    fireEvent.blur(input);
    expect(input.value).toBe("R$ 9.876,50");
  });

  it("clears display when blurred with empty input", () => {
    const handle = vi.fn();
    render(<Harness initial={100} onChange={handle} />);
    const input = screen.getByTestId("currency") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("");
    expect(handle).toHaveBeenLastCalledWith(null);
  });

  it("shows an editable raw number on focus", () => {
    render(<Harness initial={1234.5} />);
    const input = screen.getByTestId("currency") as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.value).toBe("1234,50");
  });
});
