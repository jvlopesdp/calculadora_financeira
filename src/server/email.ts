import { Resend } from "resend";

import type { Env } from "./env";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via Resend.
 *
 * Behavior:
 * - If `env.RESEND_API_KEY` is empty/missing (dev), logs the email payload to
 *   the console and returns without sending. This keeps local development free
 *   of the need for a live Resend key.
 * - On a real send, errors returned by the Resend SDK are logged with structured
 *   metadata and rethrown so the caller (Better Auth handlers) can react.
 */
export async function sendEmail(
  { to, subject, html, text }: SendEmailInput,
  env: Env,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.info("[email] RESEND_API_KEY not set — email not sent (dev mode)", {
      to,
      subject,
      from: env.EMAIL_FROM,
      textPreview: text.slice(0, 200),
    });
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[email] resend send failed", {
      to,
      subject,
      from: env.EMAIL_FROM,
      errorName: error.name,
      errorMessage: error.message,
      statusCode: error.statusCode,
    });
    throw new Error(`Resend send failed: ${error.name} — ${error.message}`);
  }
}

export type { SendEmailInput };
