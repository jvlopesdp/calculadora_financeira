import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { sharedAuthOptions } from "./auth-options";
import { sendEmail } from "./email";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "./email-templates";
import type { Env } from "./env";
import { applyRateLimit, resolveForgotPasswordRule } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

const TURNSTILE_PROTECTED_PATHS = new Set<string>([
  "/sign-up/email",
  "/sign-in/email",
]);

function extractRemoteIp(headers: Headers | undefined): string | undefined {
  if (!headers) return undefined;
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return undefined;
}

/**
 * Pure function — returns the `socialProviders` block for Better Auth when both
 * Google secrets are present, or an empty object otherwise. Extracted so it can
 * be unit-tested without instantiating betterAuth (which fires a background D1
 * init promise that causes unhandled rejections in tests with a fake DB).
 */
export function googleSocialProvider(env: Pick<Env, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">) {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return {
      socialProviders: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      },
    };
  }
  return {};
}

/**
 * Extract a query-string parameter from a (possibly malformed) URL without
 * throwing. Better Auth hands us an absolute action URL that points at its own
 * `/api/auth/*` endpoint; we only need the embedded `token`/`callbackURL`.
 */
function getUrlParam(originalUrl: string, name: string): string | null {
  try {
    return new URL(originalUrl).searchParams.get(name);
  } catch {
    return null;
  }
}

/**
 * Rewrite Better Auth's verification URL into a link that lands on the existing
 * SPA route `/verify-email?token=...` (served by the Worker) instead of the
 * Better Auth `/api/auth/*` endpoint, which falls through to the SPA 404.
 * Preserves `callbackURL` when present in the original URL.
 *
 * Pure + exported so it can be unit-tested without instantiating betterAuth
 * (which fires a background D1 init promise — see `googleSocialProvider`).
 */
export function buildVerificationUrl(publicAppUrl: string, originalUrl: string): string {
  const base = publicAppUrl.replace(/\/+$/, "");
  const token = getUrlParam(originalUrl, "token") ?? "";
  const callbackURL = getUrlParam(originalUrl, "callbackURL");
  const callbackSuffix = callbackURL
    ? `&callbackURL=${encodeURIComponent(callbackURL)}`
    : "";
  return `${base}/verify-email?token=${encodeURIComponent(token)}${callbackSuffix}`;
}

/**
 * Rewrite Better Auth's password-reset URL into the existing SPA route
 * `/reset-password?token=...`. Pure + exported for unit testing.
 */
export function buildResetUrl(publicAppUrl: string, originalUrl: string): string {
  const base = publicAppUrl.replace(/\/+$/, "");
  const token = getUrlParam(originalUrl, "token") ?? "";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

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
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const template = verifyEmailTemplate({
          url: buildVerificationUrl(env.PUBLIC_APP_URL, url),
          name: user.name,
          publicAppUrl: env.PUBLIC_APP_URL,
        });
        await sendEmail(
          {
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
          },
          env,
        );
      },
    },
    emailAndPassword: {
      ...sharedAuthOptions.emailAndPassword,
      sendResetPassword: async ({ user, url }) => {
        const template = resetPasswordTemplate({
          url: buildResetUrl(env.PUBLIC_APP_URL, url),
          name: user.name,
          publicAppUrl: env.PUBLIC_APP_URL,
        });
        await sendEmail(
          {
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
          },
          env,
        );
      },
    },
    ...googleSocialProvider(env),
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path) return;
        const body = (ctx.body ?? undefined) as
          | Record<string, unknown>
          | undefined;

        // Email-based rate limit for password reset. IP-based limits for
        // /sign-in/email and /sign-up/email are configured via Better Auth's
        // built-in `rateLimit.customRules` in `auth-options.ts`.
        const forgotRule = resolveForgotPasswordRule(ctx.path, body);
        if (forgotRule) {
          const result = await applyRateLimit(env.DB, forgotRule);
          if (!result.ok) {
            const retryAfter = String(result.retryAfter);
            throw new APIError(
              "TOO_MANY_REQUESTS",
              {
                message:
                  "Muitas tentativas. Aguarde antes de pedir um novo email de redefinição.",
                code: "RATE_LIMIT_EXCEEDED",
              },
              {
                "Retry-After": retryAfter,
                "X-Retry-After": retryAfter,
              },
            );
          }
        }

        if (TURNSTILE_PROTECTED_PATHS.has(ctx.path)) {
          const rawToken = body?.turnstileToken;
          const token = typeof rawToken === "string" ? rawToken : "";
          const remoteIp = extractRemoteIp(ctx.request?.headers);
          const ok = await verifyTurnstile(token, env, remoteIp);
          if (!ok) {
            throw new APIError("BAD_REQUEST", {
              message:
                "Verificação anti-bot inválida. Recarregue a página e tente novamente.",
              code: "TURNSTILE_INVALID",
            });
          }
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
