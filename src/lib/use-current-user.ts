import { authClient, type AuthUser } from "./auth-client";

export interface UseCurrentUserResult {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Reads the current Better Auth session and exposes the user (or null when
 * anonymous). Wraps `authClient.useSession` so consumers don't depend directly
 * on Better Auth's React hook shape.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const session = authClient.useSession();
  return {
    user: session.data?.user ?? null,
    isLoading: session.isPending,
    error: session.error ?? null,
  };
}
