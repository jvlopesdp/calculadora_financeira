-- Better Auth rate limit table (SQLite / Cloudflare D1).
-- Used by `betterAuth({ rateLimit: { storage: "database" } })` to throttle
-- /sign-in/email and /sign-up/email requests per IP, and by our custom
-- email-based limiter in `src/server/rate-limit.ts` for /request-password-reset.

create table "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" integer not null
);
