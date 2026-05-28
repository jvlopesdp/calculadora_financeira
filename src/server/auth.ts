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
        const template = verifyEmailTemplate({ url, name: user.name });
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
        const template = resetPasswordTemplate({ url, name: user.name });
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
    // Additive social login: only wire Google when BOTH secrets are present, so
    // the email/password flow is unaffected when they are missing (dev/preview).
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
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
