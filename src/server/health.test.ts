import { describe, expect, it, vi } from "vitest";

import app from "./index";
import type { Env } from "./env";

vi.mock("./auth", () => ({
  createAuth: vi.fn(),
}));

function baseEnv(environment?: string): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: environment,
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
  };
}

describe("GET /api/health", () => {
  it("returns ok, version (Vite-defined SHA), and environment", async () => {
    const res = await app.request("/api/health", { method: "GET" }, baseEnv("test"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; version: string; environment: string };
    expect(body.ok).toBe(true);
    expect(body.environment).toBe("test");
    // Vite replaces __COMMIT_SHA__ at build time; in vitest it is also injected via `define`.
    // The fallback in vite.config.ts is "dev", and CI sets it from process.env.GITHUB_SHA.
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });

  it("defaults environment to 'production' when binding is missing", async () => {
    const res = await app.request("/api/health", { method: "GET" }, baseEnv(undefined));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { environment: string };
    expect(body.environment).toBe("production");
  });
});
