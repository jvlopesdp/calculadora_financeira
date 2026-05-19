import { betterAuth } from "better-auth";

import { sharedAuthOptions } from "./auth-options";
import { sendEmail } from "./email";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "./email-templates";
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
  });
}

export type Auth = ReturnType<typeof createAuth>;
