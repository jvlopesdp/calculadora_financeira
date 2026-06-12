/**
 * Draft persistence for the Simulador's financing form. The "draft" is the raw
 * (possibly partial / invalid) financing input so a page refresh never loses
 * what the user typed. It is mirrored to `localStorage` (always) and, for
 * authenticated users, to D1 via `PUT /api/drafts`.
 *
 * Pure helpers over `window.localStorage`, wrapped in try/catch so private-mode
 * or disabled storage never throws. The shape mirrors the financing form's raw
 * `FormShape`, not the validated `FinancingFormValues`, so a partial draft can
 * still be saved and restored.
 */

export const SIM_DRAFT_KEY = "sim-draft-v1";

export type AmortizationSystem = "PRICE" | "SAC";

export type FinancingDraft = {
  propertyValue: number | null;
  downPayment: number | null;
  monthlyRate: number | null;
  termMonths: number | null;
  system: AmortizationSystem;
};

export const EMPTY_FINANCING_DRAFT: FinancingDraft = {
  propertyValue: null,
  downPayment: null,
  monthlyRate: null,
  termMonths: null,
  system: "PRICE",
};

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A draft with no meaningful input — equivalent to "no draft at all". */
export function isEmptyFinancingDraft(draft: FinancingDraft): boolean {
  return (
    draft.propertyValue === null &&
    draft.downPayment === null &&
    draft.monthlyRate === null &&
    draft.termMonths === null &&
    draft.system === "PRICE"
  );
}

/**
 * Coerce an opaque payload (localStorage JSON or a D1 draft) into a
 * `FinancingDraft`. Returns `null` for non-objects and for empty drafts so
 * callers never restore a wholly blank form over real input.
 */
export function parseFinancingDraft(raw: unknown): FinancingDraft | null {
  if (raw === null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const draft: FinancingDraft = {
    propertyValue: toNumberOrNull(obj.propertyValue),
    downPayment: toNumberOrNull(obj.downPayment),
    monthlyRate: toNumberOrNull(obj.monthlyRate),
    termMonths: toNumberOrNull(obj.termMonths),
    system: obj.system === "SAC" ? "SAC" : "PRICE",
  };
  return isEmptyFinancingDraft(draft) ? null : draft;
}

export function readLocalDraft(): FinancingDraft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SIM_DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return parseFinancingDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: FinancingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore: storage may be unavailable (private mode quota, disabled)
  }
}
