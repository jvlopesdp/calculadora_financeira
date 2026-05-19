import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PercentageInput } from "@/components/finance/percentage-input";

function Harness({
  initial = null,
  decimals,
  onChange,
}: {
  initial?: number | null;
  decimals?: number;
  onChange?: (v: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <PercentageInput
      data-testid="percentage"
      value={value}
      decimals={decimals}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("PercentageInput", () => {
  it("renders the initial value formatted as percent", () => {
    render(<Harness initial={1.25} />);
    const input = screen.getByTestId("percentage") as HTMLInputElement;
    expect(input.value).toBe("1,25%");
  });

  it("supports custom decimal precision", () => {
    render(<Harness initial={0.8} decimals={4} />);
    const input = screen.getByTestId("percentage") as HTMLInputElement;
    expect(input.value).toBe("0,8000%");
  });

  it("calls onChange with a numeric percent value on change", () => {
    const handle = vi.fn();
    render(<Harness onChange={handle} />);
    const input = screen.getByTestId("percentage");
    fireEvent.change(input, { target: { value: "1,25" } });
    expect(handle).toHaveBeenLastCalledWith(1.25);
  });

  it("reformats to percent on blur", () => {
    render(<Harness initial={null} />);
    const input = screen.getByTestId("percentage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,2" } });
    fireEvent.blur(input);
    expect(input.value).toBe("1,20%");
  });

  it("shows an editable raw number on focus", () => {
    render(<Harness initial={1.25} decimals={2} />);
    const input = screen.getByTestId("percentage") as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.value).toBe("1,25");
  });

  it("emits null when input is blanked", () => {
    const handle = vi.fn();
    render(<Harness initial={1.25} onChange={handle} />);
    const input = screen.getByTestId("percentage") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("");
    expect(handle).toHaveBeenLastCalledWith(null);
  });
});
