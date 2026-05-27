/**
 * Helpers for migrating an MVP-era localStorage simulation into the
 * authenticated D1-backed scenario list. Pure functions over `window.localStorage`
 * so they can be unit-tested under jsdom without UI scaffolding.
 *
 * The "lastSimulation" key was used by the original browser-only build to
 * remember the last form values across reloads. After auth was added (US-007+),
 * persistence moved to the API. Existing users may still have local data — we
 * offer a one-shot import on their first authenticated visit and mark it done
 * so the prompt never reappears.
 */
import type { CreateScenarioInput } from "@/lib/api-client";

export const LEGACY_SIMULATION_KEY = "lastSimulation";
export const MIGRATION_DONE_KEY = "migrationDone";

export interface LegacySimulation {
  name: string;
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  startDate: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseLegacySimulation(raw: unknown): LegacySimulation | null {
  if (raw === null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const propertyValue = Number(obj.propertyValue);
  const downPayment = Number(obj.downPayment);
  const termMonthsRaw = Number(obj.termMonths);
  const annualRate = Number(obj.annualRate);

  if (
    !Number.isFinite(propertyValue) ||
    propertyValue <= 0 ||
    !Number.isFinite(downPayment) ||
    downPayment < 0 ||
    !Number.isFinite(termMonthsRaw) ||
    termMonthsRaw <= 0 ||
    !Number.isInteger(termMonthsRaw) ||
    !Number.isFinite(annualRate) ||
    annualRate <= 0 ||
    downPayment >= propertyValue
  ) {
    return null;
  }

  const startDate =
    typeof obj.startDate === "string" && ISO_DATE_RE.test(obj.startDate)
      ? obj.startDate
      : todayIso();

  const rawName = typeof obj.name === "string" ? obj.name.trim() : "";
  const name =
    rawName.length > 0 ? rawName.slice(0, 100) : "Simulação importada do navegador";

  return {
    name,
    propertyValue,
    downPayment,
    termMonths: termMonthsRaw,
    annualRate,
    startDate,
  };
}

export function readLegacySimulation(): LegacySimulation | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEGACY_SIMULATION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return parseLegacySimulation(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function isMigrationDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MIGRATION_DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markMigrationDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
  } catch {
    // ignore: storage may be unavailable (private mode quota, disabled)
  }
}

export function clearLegacySimulation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_SIMULATION_KEY);
  } catch {
    // ignore
  }
}

export function legacyToCreateInput(
  legacy: LegacySimulation,
): CreateScenarioInput {
  return {
    name: legacy.name,
    propertyValue: legacy.propertyValue,
    downPayment: legacy.downPayment,
    termMonths: legacy.termMonths,
    annualRate: legacy.annualRate,
    startDate: legacy.startDate,
  };
}
