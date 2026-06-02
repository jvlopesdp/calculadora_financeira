import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { getDraft, putDraft, type DraftResponse } from "@/lib/api-client";

export const DRAFT_QUERY_KEY = ["draft"] as const;

export interface UseDraftQueryOptions {
  enabled?: boolean;
}

/**
 * Reads the user's saved simulator draft from D1 (`GET /api/scenarios/draft`).
 * Gate with `{ enabled: isLoggedIn }` — anonymous users have no server draft.
 */
export function useDraftQuery(
  options: UseDraftQueryOptions = {},
): UseQueryResult<DraftResponse, Error> {
  return useQuery({
    queryKey: DRAFT_QUERY_KEY,
    queryFn: () => getDraft(),
    enabled: options.enabled ?? true,
  });
}

/**
 * Upserts the user's simulator draft (`PUT /api/scenarios/draft`). Deliberately
 * does NOT invalidate `['draft']` on success: an autosave refetch could clobber
 * the input the user is still editing. Local state is the source of truth while
 * the form is open; D1 is read only on a fresh boot.
 */
export function useSaveDraft(): UseMutationResult<
  { draft: unknown; updated_at: number },
  Error,
  object
> {
  return useMutation({
    mutationFn: (payload: object) => putDraft(payload),
  });
}
