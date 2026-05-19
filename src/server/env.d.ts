/// <reference types="@cloudflare/workers-types" />

export interface Env {
  /** D1 database binding declared in wrangler.jsonc */
  DB: D1Database;
  /** Static assets binding (SPA fallback) */
  ASSETS: Fetcher;
  /** Sender address for transactional emails */
  EMAIL_FROM: string;
  /** Deployment environment label (e.g. "production", "preview", "development") */
  ENVIRONMENT?: string;
  /** Secret used by Better Auth to sign cookies/tokens */
  BETTER_AUTH_SECRET: string;
  /** Public base URL for Better Auth (must match the app origin) */
  BETTER_AUTH_URL: string;
  /** Resend API key for transactional emails. Empty/missing → logs instead of sending (dev). */
  RESEND_API_KEY?: string;
}
