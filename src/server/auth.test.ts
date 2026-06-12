import { describe, expect, it } from "vitest";

import {
  buildChangeEmailUrl,
  buildResetUrl,
  buildVerificationUrl,
} from "./auth";

// Tests the pure URL-rewriting helpers directly — no betterAuth() instantiation,
// no background D1 init promise, no unhandled rejections under load (same
// pattern as `googleSocialProvider` in auth-google.test.ts).
const PUBLIC_APP_URL = "https://example.test";

describe("buildVerificationUrl", () => {
  it("rewrites a Better Auth verify URL to the SPA /verify-email route", () => {
    const original =
      "https://api.example.test/api/auth/verify-email?token=abc123&callbackURL=/login";
    const result = buildVerificationUrl(PUBLIC_APP_URL, original);
    expect(result.startsWith(`${PUBLIC_APP_URL}/verify-email?token=`)).toBe(true);
    expect(result).toContain("token=abc123");
  });

  it("preserves callbackURL when present in the original URL", () => {
    const original =
      "https://api.example.test/api/auth/verify-email?token=tok&callbackURL=/login";
    const result = buildVerificationUrl(PUBLIC_APP_URL, original);
    expect(result).toContain(`callbackURL=${encodeURIComponent("/login")}`);
  });

  it("omits callbackURL when absent", () => {
    const original = "https://api.example.test/api/auth/verify-email?token=tok";
    const result = buildVerificationUrl(PUBLIC_APP_URL, original);
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=tok`);
  });

  it("trims a trailing slash from the public app URL", () => {
    const original = "https://api.example.test/api/auth/verify-email?token=tok";
    const result = buildVerificationUrl(`${PUBLIC_APP_URL}/`, original);
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=tok`);
  });

  it("extracts the token via searchParams from a non-standard URL", () => {
    const original = "https://api.example.test/api/auth/verify-email?foo=bar&token=xyz";
    const result = buildVerificationUrl(PUBLIC_APP_URL, original);
    expect(result.startsWith(`${PUBLIC_APP_URL}/verify-email?token=xyz`)).toBe(true);
  });

  it("falls back to an empty token for a malformed URL", () => {
    const result = buildVerificationUrl(PUBLIC_APP_URL, "not-a-url");
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=`);
  });
});

describe("buildResetUrl", () => {
  it("rewrites a Better Auth reset URL to the SPA /reset-password route", () => {
    const original =
      "https://api.example.test/api/auth/reset-password?token=reset789";
    const result = buildResetUrl(PUBLIC_APP_URL, original);
    expect(result.startsWith(`${PUBLIC_APP_URL}/reset-password?token=`)).toBe(true);
    expect(result).toBe(`${PUBLIC_APP_URL}/reset-password?token=reset789`);
  });

  it("trims a trailing slash from the public app URL", () => {
    const original = "https://api.example.test/api/auth/reset-password?token=tok";
    const result = buildResetUrl(`${PUBLIC_APP_URL}/`, original);
    expect(result).toBe(`${PUBLIC_APP_URL}/reset-password?token=tok`);
  });

  it("falls back to an empty token for a malformed URL", () => {
    const result = buildResetUrl(PUBLIC_APP_URL, "not-a-url");
    expect(result).toBe(`${PUBLIC_APP_URL}/reset-password?token=`);
  });
});

describe("buildChangeEmailUrl", () => {
  it("rewrites the Better Auth change-email URL to the SPA /verify-email route", () => {
    const original =
      "https://api.example.test/api/auth/verify-email?token=change-tok";
    const result = buildChangeEmailUrl(PUBLIC_APP_URL, original);
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=change-tok`);
  });

  it("trims a trailing slash from the public app URL", () => {
    const original = "https://api.example.test/api/auth/verify-email?token=t";
    const result = buildChangeEmailUrl(`${PUBLIC_APP_URL}/`, original);
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=t`);
  });

  it("falls back to an empty token for a malformed URL", () => {
    const result = buildChangeEmailUrl(PUBLIC_APP_URL, "not-a-url");
    expect(result).toBe(`${PUBLIC_APP_URL}/verify-email?token=`);
  });
});
