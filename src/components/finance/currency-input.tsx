import * as React from "react";
import Decimal from "decimal.js";

import { Input, type InputProps } from "@/components/ui/input";
import { formatBRL, parseBRL } from "@/lib/formatters/currency";

export type CurrencyInputProps = Omit<
  InputProps,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

function formatEditable(value: number): string {
  return new Decimal(value)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
    .toFixed(2)
    .replace(".", ",");
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onBlur, placeholder, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(() =>
      value === null || value === undefined ? "" : formatBRL(value),
    );
    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (focused) return;
      if (value === null || value === undefined) {
        setDisplay("");
      } else {
        setDisplay(formatBRL(value));
      }
    }, [value, focused]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder ?? "R$ 0,00"}
        onFocus={(event) => {
          setFocused(true);
          if (value !== null && value !== undefined) {
            setDisplay(formatEditable(value));
            requestAnimationFrame(() => event.target.select());
          }
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDisplay(next);
          onChange(parseBRL(next));
        }}
        onBlur={(event) => {
          setFocused(false);
          const parsed = parseBRL(display);
          onChange(parsed);
          setDisplay(parsed === null ? "" : formatBRL(parsed));
          onBlur?.(event);
        }}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
