import { createAuthClient } from "better-auth/react";

function resolveBaseURL(): string {
  const fromEnv = import.meta.env.VITE_APP_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
});

export const { useSession, signIn, signUp, signOut } = authClient;

export type AuthClient = typeof authClient;
export type SessionData = ReturnType<typeof authClient.useSession>["data"];
export type AuthUser = NonNullable<SessionData>["user"];
export type AuthSession = NonNullable<SessionData>["session"];
