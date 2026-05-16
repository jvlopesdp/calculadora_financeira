import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

import {
  SimulationContext,
  type SimulationContextValue,
} from "@/features/simulator/hooks/simulation-context";

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [financing, setFinancingState] = useState<FinancingFormValues | null>(
    null,
  );
  const [extraMonthly, setExtraMonthlyState] = useState<number | null>(null);

  const setFinancing = useCallback((values: FinancingFormValues | null) => {
    setFinancingState(values);
  }, []);

  const setExtraMonthly = useCallback((value: number | null) => {
    setExtraMonthlyState(value);
  }, []);

  const value = useMemo<SimulationContextValue>(
    () => ({ financing, extraMonthly, setFinancing, setExtraMonthly }),
    [financing, extraMonthly, setFinancing, setExtraMonthly],
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
