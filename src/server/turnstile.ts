import type { Env } from "./env";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Verify a Cloudflare Turnstile token via the official siteverify endpoint.
 *
 * Behavior:
 * - Dev mode: when `env.TURNSTILE_SECRET_KEY` is empty/missing, logs a warning
 *   and returns `true` so local development isn't blocked by Turnstile.
 * - Network/parse errors are caught, logged, and result in `false` (fail-closed).
 * - Otherwise returns whatever Cloudflare reports in `success`.
 */
export async function verifyTurnstile(
  token: string,
  env: Env,
  remoteIp?: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY not set — accepting token without verification (dev mode)",
    );
    return true;
  }

  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = (await res.json()) as SiteVerifyResponse;

    if (!data.success) {
      console.warn("[turnstile] siteverify rejected token", {
        errorCodes: data["error-codes"],
        hostname: data.hostname,
      });
    }

    return data.success === true;
  } catch (error) {
    console.error("[turnstile] siteverify request failed", error);
    return false;
  }
}
