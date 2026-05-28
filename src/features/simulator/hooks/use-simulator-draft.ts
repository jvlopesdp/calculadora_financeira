import { useCallback, useEffect, useRef, useState } from "react";

import { useDraftQuery, useSaveDraft } from "@/lib/queries/draft";
import { useSession } from "@/lib/queries/session";
import {
  parseFinancingDraft,
  readLocalDraft,
  writeLocalDraft,
  type FinancingDraft,
} from "@/features/simulator/lib/simulator-draft";

export const DRAFT_AUTOSAVE_DEBOUNCE_MS = 500;

export interface UseSimulatorDraftResult {
  /** Draft available synchronously on first render (from localStorage). */
  initialFinancing: FinancingDraft | null;
  /** A later draft to apply (e.g. the D1 draft for a logged-in user). */
  restoredFinancing: FinancingDraft | null;
  /** Increments whenever `restoredFinancing` should be (re)applied. */
  restoreToken: number;
  /** Report a live form change — debounce-persists to localStorage (+ D1). */
  reportInput: (draft: FinancingDraft) => void;
}

/**
 * Owns the simulator draft lifecycle for the financing form:
 *  - restores the most recent draft on boot (localStorage synchronously; the D1
 *    draft is preferred once it arrives for authenticated users);
 *  - autosaves input changes (debounced) to localStorage always and to D1 when
 *    logged in.
 *
 * A late D1 restore never overwrites input the user has already started editing
 * (`hasUserEditedRef`), so a slow query cannot wipe in-progress work.
 *
 * Must be used below the `QueryClientProvider` (e.g. inside the financing form),
 * since `SimulationProvider` is mounted above it.
 */
export function useSimulatorDraft(): UseSimulatorDraftResult {
  const { user } = useSession();
  const isLoggedIn = Boolean(user);

  const [initialFinancing] = useState<FinancingDraft | null>(() =>
    readLocalDraft(),
  );

  const draftQuery = useDraftQuery({ enabled: isLoggedIn });
  const saveDraft = useSaveDraft();

  const saveMutateRef = useRef(saveDraft.mutate);
  saveMutateRef.current = saveDraft.mutate;
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  const hasUserEditedRef = useRef(false);
  const appliedD1Ref = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [restoredFinancing, setRestoredFinancing] =
    useState<FinancingDraft | null>(null);
  const [restoreToken, setRestoreToken] = useState(0);

  // Prefer the D1 draft once it resolves — but only once, and never over input
  // the user has already begun editing.
  useEffect(() => {
    if (!isLoggedIn || appliedD1Ref.current || !draftQuery.isSuccess) return;
    appliedD1Ref.current = true;
    if (hasUserEditedRef.current) return;
    const d1Draft = parseFinancingDraft(draftQuery.data?.draft ?? null);
    if (!d1Draft) return;
    setRestoredFinancing(d1Draft);
    setRestoreToken((token) => token + 1);
  }, [isLoggedIn, draftQuery.isSuccess, draftQuery.data]);

  const reportInput = useCallback((draft: FinancingDraft) => {
    hasUserEditedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      writeLocalDraft(draft);
      if (isLoggedInRef.current) {
        saveMutateRef.current(draft);
      }
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { initialFinancing, restoredFinancing, restoreToken, reportInput };
}
