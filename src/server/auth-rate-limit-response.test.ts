import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "./index";
import { createAuth } from "./auth";
import type { Env } from "./env";

vi.mock("./auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

function baseEnv(): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: "test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
  };
}

function setAuthHandler(handler: (req: Request) => Response | Promise<Response>) {
  mockedCreateAuth.mockReturnValue({
    handler,
  } as unknown as ReturnType<typeof createAuth>);
}

describe("/api/auth/* — Retry-After header translation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedCreateAuth.mockReset();
  });

  it("mirrors X-Retry-After to Retry-After on 429 responses", async () => {
    setAuthHandler(
      () =>
        new Response(
          JSON.stringify({ message: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: { "X-Retry-After": "42" },
          },
        ),
    );

    const res = await app.request(
      "/api/auth/sign-in/email",
      { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } },
      baseEnv(),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("X-Retry-After")).toBe("42");
  });

  it("does not overwrite Retry-After when it is already present", async () => {
    setAuthHandler(
      () =>
        new Response(JSON.stringify({ message: "rate limit" }), {
          status: 429,
          headers: { "Retry-After": "60", "X-Retry-After": "999" },
        }),
    );

    const res = await app.request(
      "/api/auth/request-password-reset",
      { method: "POST", body: JSON.stringify({ email: "x@y.com" }), headers: { "content-type": "application/json" } },
      baseEnv(),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("passes 2xx responses through untouched", async () => {
    setAuthHandler(
      () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const res = await app.request(
      "/api/auth/sign-in/email",
      { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } },
      baseEnv(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Retry-After")).toBeNull();
  });
});
