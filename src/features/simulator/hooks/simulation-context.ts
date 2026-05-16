import { createContext, useContext } from "react";

import type { FinancingFormValues } from "@/features/simulator/schemas/financing";

export type SimulationState = {
  financing: FinancingFormValues | null;
  extraMonthly: number | null;
};

export type SimulationContextValue = SimulationState & {
  setFinancing: (values: FinancingFormValues | null) => void;
  setExtraMonthly: (value: number | null) => void;
};

export const SimulationContext = createContext<SimulationContextValue | null>(
  null,
);

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return ctx;
}
