import {
  CalendarCheckIcon,
  FolderIcon,
  PiggyBankIcon,
  WalletIcon,
} from "lucide-react";

import type { KpiCardData } from "@/components/section-cards";

const PLACEHOLDER_HINT = "Disponível em breve";

/**
 * Histórico KPIs surface placeholder values until the history feature
 * (US-027+) wires real scenarios/payments. Kept here so swapping in the
 * real data later is a localized change.
 */
export function buildHistoricoKpis(): KpiCardData[] {
  return [
    {
      title: "Cenários ativos",
      value: "—",
      hint: PLACEHOLDER_HINT,
      icon: FolderIcon,
    },
    {
      title: "Saldo devedor total",
      value: "—",
      hint: PLACEHOLDER_HINT,
      icon: WalletIcon,
    },
    {
      title: "Pagamentos no mês corrente",
      value: "—",
      hint: PLACEHOLDER_HINT,
      icon: CalendarCheckIcon,
    },
    {
      title: "Economia acumulada",
      value: "—",
      hint: PLACEHOLDER_HINT,
      icon: PiggyBankIcon,
    },
  ];
}
