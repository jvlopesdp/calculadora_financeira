import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { sharedAuthOptions } from "./auth-options";
import { sendEmail } from "./email";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "./email-templates";
import type { Env } from "./env";
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path || !TURNSTILE_PROTECTED_PATHS.has(ctx.path)) {
          return;
        }
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const rawToken = body.turnstileToken;
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
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
