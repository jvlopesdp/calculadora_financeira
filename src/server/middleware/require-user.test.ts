import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import { requireUser, type AuthVariables } from "./require-user";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

type GetSessionInput = { headers: Headers };
type GetSessionFn = (input: GetSessionInput) => Promise<unknown>;

function buildApp(getSession: GetSessionFn) {
  mockedCreateAuth.mockReturnValue({
    api: { getSession },
  } as unknown as ReturnType<typeof createAuth>);

  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("/api/*", requireUser);
  app.get("/api/protected", (c) =>
    c.json({ user: c.get("user"), session: c.get("session") }),
  );
  return app;
}

const fakeEnv = {
  DB: {} as D1Database,
  ASSETS: {} as Fetcher,
  EMAIL_FROM: "no-reply@example.com",
  ENVIRONMENT: "test",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost",
} satisfies Env;

describe("requireUser middleware", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  it("allows the request through and exposes user/session when the session is valid", async () => {
    const fakeUser = { id: "user-1", email: "user@example.com" };
    const fakeSession = { id: "sess-1", token: "abc", expiresAt: new Date() };
    const getSession = vi.fn<GetSessionFn>(async ({ headers }) => {
      expect(headers.get("cookie")).toBe("better-auth.session_token=valid");
      return { user: fakeUser, session: fakeSession };
    });

    const app = buildApp(getSession);
    const res = await app.request(
      "/api/protected",
      { headers: { cookie: "better-auth.session_token=valid" } },
      fakeEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: unknown; session: unknown };
    expect(body.user).toEqual(fakeUser);
    expect(body.session).toEqual({
      ...fakeSession,
      expiresAt: fakeSession.expiresAt.toISOString(),
    });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("returns 401 unauthorized when no session cookie is present", async () => {
    const getSession = vi.fn<GetSessionFn>(async () => null);
    const app = buildApp(getSession);

    const res = await app.request("/api/protected", {}, fakeEnv);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("returns 401 unauthorized when the session has expired (getSession returns null)", async () => {
    const getSession = vi.fn<GetSessionFn>(async ({ headers }) => {
      // Better Auth returns null when the cookie is present but the underlying
      // session row is expired or revoked.
      expect(headers.get("cookie")).toBe("better-auth.session_token=expired");
      return null;
    });
    const app = buildApp(getSession);

    const res = await app.request(
      "/api/protected",
      { headers: { cookie: "better-auth.session_token=expired" } },
      fakeEnv,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when getSession throws (treats errors as no session)", async () => {
    const getSession = vi.fn<GetSessionFn>(async () => {
      throw new Error("d1 read failed");
    });
    const app = buildApp(getSession);

    const res = await app.request("/api/protected", {}, fakeEnv);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
