import { describe, expect, it } from "vitest";

import { createAuth } from "./auth";
import type { Env } from "./env";

function baseEnv(extra: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: "test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
    ...extra,
  };
}

// `betterAuth()` keeps the raw options it received on `.options`, so inspecting
// `createAuth(env).options.socialProviders` tells us whether Google was wired.
function socialProvidersOf(env: Env): unknown {
  return (createAuth(env) as unknown as { options?: { socialProviders?: unknown } })
    .options?.socialProviders;
}

describe("createAuth — Google social provider gating", () => {
  it("omits socialProviders when GOOGLE_CLIENT_ID is absent", () => {
    expect(socialProvidersOf(baseEnv())).toBeUndefined();
  });

  it("omits socialProviders when only GOOGLE_CLIENT_ID is set", () => {
    expect(socialProvidersOf(baseEnv({ GOOGLE_CLIENT_ID: "id-only" }))).toBeUndefined();
  });

  it("omits socialProviders when only GOOGLE_CLIENT_SECRET is set", () => {
    expect(
      socialProvidersOf(baseEnv({ GOOGLE_CLIENT_SECRET: "secret-only" })),
    ).toBeUndefined();
  });

  it("wires google when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present", () => {
    const social = socialProvidersOf(
      baseEnv({ GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" }),
    ) as { google?: { clientId?: string; clientSecret?: string } } | undefined;

    expect(social).toBeDefined();
    expect(social?.google).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
  });
});
