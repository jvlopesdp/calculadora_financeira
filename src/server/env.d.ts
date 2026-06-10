/// <reference types="@cloudflare/workers-types" />

declare global {
  /** Build-time injected commit SHA (Vite `define`). Falls back to "dev" outside CI. */
  const __COMMIT_SHA__: string;
}

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
  /** Public origin of the SPA, used to build email action links (verify/reset). e.g. https://calculadorafinanceira.app */
  PUBLIC_APP_URL: string;
  /** Resend API key for transactional emails. Empty/missing → logs instead of sending (dev). */
  RESEND_API_KEY?: string;
  /** Cloudflare Turnstile secret key for server-side siteverify. Empty/missing → bypass (dev). */
  TURNSTILE_SECRET_KEY?: string;
  /** Google OAuth client ID. Set together with GOOGLE_CLIENT_SECRET to enable social login. */
  GOOGLE_CLIENT_ID?: string;
  /** Google OAuth client secret. Set together with GOOGLE_CLIENT_ID to enable social login. */
  GOOGLE_CLIENT_SECRET?: string;
}
