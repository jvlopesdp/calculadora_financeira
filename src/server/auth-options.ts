import type { BetterAuthOptions } from "better-auth";

/**
 * Auth options shared between the runtime Worker config and the better-auth
 * CLI config (which uses an in-memory SQLite database to generate migrations).
 *
 * Anything that depends on the runtime D1 binding lives in `auth.ts`.
 */
export const sharedAuthOptions = {
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    "http://localhost:5173",
    "https://calculadorafinanceira.app",
  ],
} satisfies Partial<BetterAuthOptions>;
