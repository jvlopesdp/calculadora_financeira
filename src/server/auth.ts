import { betterAuth } from "better-auth";

import { sharedAuthOptions } from "./auth-options";
import type { Env } from "./env";

/**
 * Build a Better Auth instance bound to the current request's environment.
 * Created per-request because each Worker request carries its own D1 binding
 * and secret values (no module-level singletons in Cloudflare Workers).
 */
export function createAuth(env: Env) {
  return betterAuth({
    ...sharedAuthOptions,
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
}

export type Auth = ReturnType<typeof createAuth>;
