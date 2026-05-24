import type { Env } from "./env";

/**
 * Rate-limit rules + helper used by the Better Auth before-hook for
 * email-based limiting on `/request-password-reset`. The IP-based limits for
 * `/sign-in/email` and `/sign-up/email` are configured directly via Better
 * Auth's built-in `rateLimit.customRules` (which shares the same `rateLimit`
 * D1 table created in `migrations/0003_rate_limit.sql`).
 */
export interface RateLimitRule {
  /** Storage key — typically `"<bucket>:<identifier>"`. Must be unique per bucket. */
  key: string;
  /** Maximum number of requests allowed within `windowSeconds`. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

/**
 * Apply a fixed-window rate limit against the Better Auth `rateLimit` table.
 *
 * Uses the same row layout the built-in database storage uses (`key`, `count`,
 * `lastRequest`) so keys are namespaced into the same table — keep prefixes
 * distinct from Better Auth's IP-based keys (`<ip>|<path>`) to avoid
 * collisions.
 */
export async function applyRateLimit(
  db: D1Database,
  rule: RateLimitRule,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;

  const existing = await db
    .prepare('select "count", "lastRequest" from "rateLimit" where "key" = ?')
    .bind(rule.key)
    .first<{ count: number; lastRequest: number }>();

  if (!existing) {
    await db
      .prepare(
        'insert into "rateLimit" ("id", "key", "count", "lastRequest") values (?, ?, 1, ?)',
      )
      .bind(crypto.randomUUID(), rule.key, now)
      .run();
    return { ok: true };
  }

  const elapsed = now - existing.lastRequest;
  if (elapsed >= windowMs) {
    await db
      .prepare(
        'update "rateLimit" set "count" = 1, "lastRequest" = ? where "key" = ?',
      )
      .bind(now, rule.key)
      .run();
    return { ok: true };
  }

  if (existing.count >= rule.max) {
    const retryAfter = Math.max(
      1,
      Math.ceil((existing.lastRequest + windowMs - now) / 1000),
    );
    return { ok: false, retryAfter };
  }

  await db
    .prepare(
      'update "rateLimit" set "count" = ?, "lastRequest" = ? where "key" = ?',
    )
    .bind(existing.count + 1, now, rule.key)
    .run();
  return { ok: true };
}

/**
 * Limits applied by our custom before-hook. The IP-based sign-in/sign-up
 * limits live in Better Auth's `rateLimit.customRules` (see
 * `src/server/auth.ts`) — keep both in sync if either set changes.
 */
export const FORGOT_PASSWORD_PATH = "/request-password-reset";

export const FORGOT_PASSWORD_RULE = {
  max: 3,
  windowSeconds: 60 * 60,
} as const;

/**
 * Resolve the email-keyed rate-limit rule for `/request-password-reset`.
 * Returns `null` when the path doesn't match or the body lacks an email
 * (so the request can continue to Better Auth's normal validation which
 * will return a 400 for the missing/invalid email).
 */
export function resolveForgotPasswordRule(
  path: string | undefined,
  body: Record<string, unknown> | undefined,
): RateLimitRule | null {
  if (path !== FORGOT_PASSWORD_PATH) return null;
  const rawEmail = body?.email;
  if (typeof rawEmail !== "string") return null;
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;
  return {
    key: `forgot:email:${email}`,
    max: FORGOT_PASSWORD_RULE.max,
    windowSeconds: FORGOT_PASSWORD_RULE.windowSeconds,
  };
}

/**
 * Convenience accessor for the env-bound DB used by the before-hook.
 * Re-exports the `Env` type so callers don't reach across modules.
 */
export type RateLimitEnv = Pick<Env, "DB">;
