import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "./env";
import { verifyTurnstile } from "./turnstile";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: "test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
    ...overrides,
  };
}

let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, "fetch">>;

function queueFetchResponse(value: unknown, init: ResponseInit = {}): void {
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
  fetchSpy.mockResolvedValueOnce(response);
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true and POSTs secret + token when siteverify reports success", async () => {
    queueFetchResponse({
      success: true,
      hostname: "calculadorafinanceira.app",
    });

    const env = baseEnv({ TURNSTILE_SECRET_KEY: "0x_secret" });
    const result = await verifyTurnstile("good-token", env);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    const url = call[0];
    const init = call[1]!;
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>)["content-type"],
    ).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams(init.body as string);
    expect(params.get("secret")).toBe("0x_secret");
    expect(params.get("response")).toBe("good-token");
    expect(params.has("remoteip")).toBe(false);
  });

  it("returns false when siteverify reports success=false", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    queueFetchResponse({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    const env = baseEnv({ TURNSTILE_SECRET_KEY: "0x_secret" });
    const result = await verifyTurnstile("bad-token", env);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      "[turnstile] siteverify rejected token",
    );
  });

  it("returns false when fetch throws (network error)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockRejectedValueOnce(new Error("connection reset"));

    const env = baseEnv({ TURNSTILE_SECRET_KEY: "0x_secret" });
    const result = await verifyTurnstile("any-token", env);

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      "[turnstile] siteverify request failed",
    );
  });

  it("returns true without calling fetch when TURNSTILE_SECRET_KEY is empty (dev mode)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const env = baseEnv({ TURNSTILE_SECRET_KEY: "" });
    const result = await verifyTurnstile("any-token", env);

    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      "TURNSTILE_SECRET_KEY not set",
    );
  });

  it("returns false immediately when the token is empty", async () => {
    const env = baseEnv({ TURNSTILE_SECRET_KEY: "0x_secret" });
    const result = await verifyTurnstile("", env);

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes remoteip in the siteverify payload when provided", async () => {
    queueFetchResponse({ success: true });

    const env = baseEnv({ TURNSTILE_SECRET_KEY: "0x_secret" });
    await verifyTurnstile("good-token", env, "203.0.113.7");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]![1]!;
    const params = new URLSearchParams(init.body as string);
    expect(params.get("remoteip")).toBe("203.0.113.7");
  });
});
