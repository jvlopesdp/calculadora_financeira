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
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      // 10 attempts per 15 minutes per IP — login burst protection.
      "/sign-in/email": { window: 15 * 60, max: 10 },
      // 5 sign-ups per hour per IP — signup abuse protection.
      "/sign-up/email": { window: 60 * 60, max: 5 },
      // Email-based limit is enforced by our before-hook in `auth.ts` against
      // the same `rateLimit` D1 table; disable the built-in IP-based rule for
      // this path so the two never compete.
      "/request-password-reset": false,
    },
  },
} satisfies Partial<BetterAuthOptions>;
