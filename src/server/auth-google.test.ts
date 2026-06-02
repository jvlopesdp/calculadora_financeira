import { describe, expect, it } from "vitest";

import { googleSocialProvider } from "./auth";

// Tests the pure gating function directly — no betterAuth() instantiation,
// no background D1 init promise, no unhandled rejections under load.
describe("googleSocialProvider", () => {
  it("returns empty object when GOOGLE_CLIENT_ID is absent", () => {
    expect(googleSocialProvider({})).toEqual({});
  });

  it("returns empty object when only GOOGLE_CLIENT_ID is set", () => {
    expect(googleSocialProvider({ GOOGLE_CLIENT_ID: "id-only" })).toEqual({});
  });

  it("returns empty object when only GOOGLE_CLIENT_SECRET is set", () => {
    expect(googleSocialProvider({ GOOGLE_CLIENT_SECRET: "secret-only" })).toEqual({});
  });

  it("returns socialProviders.google when both secrets are present", () => {
    const result = googleSocialProvider({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
    });
    expect(result).toEqual({
      socialProviders: {
        google: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
      },
    });
  });
});
