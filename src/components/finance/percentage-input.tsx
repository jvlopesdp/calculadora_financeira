import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";
import {
  formatPercentage,
  parsePercentage,
} from "@/lib/formatters/percentage";

export type PercentageInputProps = Omit<
  InputProps,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  decimals?: number;
};

function safeParse(input: string): number | null {
  if (input.trim() === "") return null;
  try {
    const decimal = parsePercentage(input);
    if (decimal.isNaN() || !decimal.isFinite()) return null;
    return decimal.toNumber();
  } catch {
    return null;
  }
}

function formatEditable(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

const PercentageInput = React.forwardRef<
  HTMLInputElement,
  PercentageInputProps
>(({ value, onChange, onBlur, placeholder, decimals = 2, ...props }, ref) => {
  const [display, setDisplay] = React.useState<string>(() =>
    value === null || value === undefined
      ? ""
      : formatPercentage(value, decimals),
  );
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (focused) return;
    if (value === null || value === undefined) {
      setDisplay("");
    } else {
      setDisplay(formatPercentage(value, decimals));
    }
  }, [value, focused, decimals]);

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder ?? "0,00%"}
      onFocus={(event) => {
        setFocused(true);
        if (value !== null && value !== undefined) {
          setDisplay(formatEditable(value, decimals));
          requestAnimationFrame(() => event.target.select());
        }
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDisplay(next);
        onChange(safeParse(next));
      }}
      onBlur={(event) => {
        setFocused(false);
        const parsed = safeParse(display);
        onChange(parsed);
        setDisplay(parsed === null ? "" : formatPercentage(parsed, decimals));
        onBlur?.(event);
      }}
      {...props}
    />
  );
});
PercentageInput.displayName = "PercentageInput";

export { PercentageInput };
