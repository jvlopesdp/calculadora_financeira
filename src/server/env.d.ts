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
}
