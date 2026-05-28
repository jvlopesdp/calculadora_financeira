import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { getSession, signOutRequest } from "@/lib/api-client";
import type { AuthSession, AuthUser } from "@/lib/auth-client";
import { SESSION_QUERY_KEY } from "@/lib/query-client";

export interface UseSessionResult {
  user: AuthUser | null;
  session: AuthSession | null;
  isPending: boolean;
  isError: boolean;
}

/**
 * Single source of truth for the Better Auth session, backed by TanStack Query.
 * Reads `GET /api/auth/get-session` under the `['session']` queryKey (excluded
 * from the localStorage persister) so it is always revalidated on boot. A `null`
 * response resolves to `{ user: null, session: null }`.
 */
export function useSession(): UseSessionResult {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
  });
  const data = query.data ?? null;
  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isPending: query.isPending,
    isError: query.isError,
  };
}

/**
 * Signs the user out via `POST /api/auth/sign-out` and invalidates the
 * `['session']` query so every `useSession()` consumer reverts to anonymous.
 */
export function useSignOut(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOutRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
