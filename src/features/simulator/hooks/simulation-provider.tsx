import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { FinancingFormValues } from "@/features/simulator/schemas/financing";
import type { RentVsBuyFormValues } from "@/features/simulator/schemas/rent-vs-buy";

import {
  SimulationContext,
  type ExtraPaymentStrategy,
  type SimulationContextValue,
} from "@/features/simulator/hooks/simulation-context";

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [financing, setFinancingState] = useState<FinancingFormValues | null>(
    null,
  );
  const [extraMonthly, setExtraMonthlyState] = useState<number | null>(null);
  const [extraStrategy, setExtraStrategyState] =
    useState<ExtraPaymentStrategy>("term");
  const [rentVsBuy, setRentVsBuyState] = useState<RentVsBuyFormValues | null>(
    null,
  );

  const setFinancing = useCallback((values: FinancingFormValues | null) => {
    setFinancingState(values);
  }, []);

  const setExtraMonthly = useCallback((value: number | null) => {
    setExtraMonthlyState(value);
  }, []);

  const setExtraStrategy = useCallback((strategy: ExtraPaymentStrategy) => {
    setExtraStrategyState(strategy);
  }, []);

  const setRentVsBuy = useCallback((values: RentVsBuyFormValues | null) => {
    setRentVsBuyState(values);
  }, []);

  const value = useMemo<SimulationContextValue>(
    () => ({
      financing,
      extraMonthly,
      extraStrategy,
      rentVsBuy,
      setFinancing,
      setExtraMonthly,
      setExtraStrategy,
      setRentVsBuy,
    }),
    [
      financing,
      extraMonthly,
      extraStrategy,
      rentVsBuy,
      setFinancing,
      setExtraMonthly,
      setExtraStrategy,
      setRentVsBuy,
    ],
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
