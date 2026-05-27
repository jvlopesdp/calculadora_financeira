import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyRateLimit,
  resolveForgotPasswordRule,
  FORGOT_PASSWORD_PATH,
  FORGOT_PASSWORD_RULE,
} from "./rate-limit";

interface RateLimitRow {
  id: string;
  key: string;
  count: number;
  lastRequest: number;
}

interface FakeDB {
  rows: RateLimitRow[];
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub that recognises the exact SQL shapes
 * `applyRateLimit` emits. Throws on any other SQL so a typo fails the test.
 */
function createFakeDB(initialRows: RateLimitRow[] = []): FakeDB {
  const rows: RateLimitRow[] = [...initialRows];

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];

      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('insert into "rateLimit"')) {
            const [id, key, lastRequest] = args as [string, string, number];
            rows.push({ id, key, count: 1, lastRequest });
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "rateLimit" set "count" = 1')) {
            const [lastRequest, key] = args as [number, string];
            const row = rows.find((r) => r.key === key);
            if (row) {
              row.count = 1;
              row.lastRequest = lastRequest;
            }
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "rateLimit" set "count" = ?')) {
            const [count, lastRequest, key] = args as [number, number, string];
            const row = rows.find((r) => r.key === key);
            if (row) {
              row.count = count;
              row.lastRequest = lastRequest;
            }
            return { success: true, meta: {} };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
        async first<T = unknown>(): Promise<T | null> {
          if (sql.startsWith('select "count", "lastRequest" from "rateLimit"')) {
            const [key] = args as [string];
            const row = rows.find((r) => r.key === key);
            if (!row) return null;
            return { count: row.count, lastRequest: row.lastRequest } as T;
          }
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          throw new Error(`Unhandled SQL (all): ${sql}`);
        },
      };

      return stmt;
    },
    batch: vi.fn(),
    dump: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;

  return { rows, db };
}

const RULE = { key: "test:bucket", max: 3, windowSeconds: 60 } as const;

describe("applyRateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new row with count=1 on the first request", async () => {
    const { db, rows } = createFakeDB();
    const result = await applyRateLimit(db, RULE, 1_000);

    expect(result).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("test:bucket");
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.lastRequest).toBe(1_000);
    expect(typeof rows[0]?.id).toBe("string");
    expect(rows[0]?.id.length).toBeGreaterThan(0);
  });

  it("allows bursts up to `max` requests inside the window", async () => {
    const { db, rows } = createFakeDB();

    const r1 = await applyRateLimit(db, RULE, 1_000);
    const r2 = await applyRateLimit(db, RULE, 2_000);
    const r3 = await applyRateLimit(db, RULE, 3_000);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(r3).toEqual({ ok: true });
    expect(rows[0]?.count).toBe(3);
    expect(rows[0]?.lastRequest).toBe(3_000);
  });

  it("blocks the (max + 1)th request and reports `retryAfter`", async () => {
    const { db, rows } = createFakeDB();

    await applyRateLimit(db, RULE, 0);
    await applyRateLimit(db, RULE, 1_000);
    await applyRateLimit(db, RULE, 2_000);
    const blocked = await applyRateLimit(db, RULE, 3_000);

    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected blocked");
    // window=60s, last request at 2_000ms, now 3_000ms → 59s remaining.
    expect(blocked.retryAfter).toBe(59);
    // Count is NOT incremented when blocked.
    expect(rows[0]?.count).toBe(3);
    expect(rows[0]?.lastRequest).toBe(2_000);
  });

  it("resets the counter once the window has elapsed", async () => {
    const { db, rows } = createFakeDB();

    await applyRateLimit(db, RULE, 0);
    await applyRateLimit(db, RULE, 1_000);
    await applyRateLimit(db, RULE, 2_000);
    // Just inside the window — still blocked.
    const stillBlocked = await applyRateLimit(db, RULE, 61_999);
    // Window crossed (>=60s since lastRequest at 2_000) — request allowed and
    // counter reset to 1.
    const afterWindow = await applyRateLimit(db, RULE, 62_000);

    expect(stillBlocked.ok).toBe(false);
    expect(afterWindow).toEqual({ ok: true });
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.lastRequest).toBe(62_000);
  });

  it("returns a retryAfter of at least 1 second when within the window", async () => {
    const { db } = createFakeDB();

    await applyRateLimit(db, RULE, 0);
    await applyRateLimit(db, RULE, 0);
    await applyRateLimit(db, RULE, 0);
    // 0.5 seconds before window end: ceil(0.5) → 1, never 0.
    const blocked = await applyRateLimit(db, RULE, 59_500);
    expect(blocked).toEqual({ ok: false, retryAfter: 1 });
  });

  it("treats different keys as independent buckets", async () => {
    const { db, rows } = createFakeDB();
    const ruleA = { key: "k:a", max: 1, windowSeconds: 60 } as const;
    const ruleB = { key: "k:b", max: 1, windowSeconds: 60 } as const;

    const a1 = await applyRateLimit(db, ruleA, 0);
    const b1 = await applyRateLimit(db, ruleB, 0);
    const a2 = await applyRateLimit(db, ruleA, 1_000);
    const b2 = await applyRateLimit(db, ruleB, 1_000);

    expect(a1).toEqual({ ok: true });
    expect(b1).toEqual({ ok: true });
    expect(a2.ok).toBe(false);
    expect(b2.ok).toBe(false);
    expect(rows).toHaveLength(2);
  });
});

describe("resolveForgotPasswordRule", () => {
  it("returns the per-email rule when path matches and email is present", () => {
    const rule = resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, {
      email: "Alice@Example.com",
    });
    expect(rule).toEqual({
      key: "forgot:email:alice@example.com",
      max: FORGOT_PASSWORD_RULE.max,
      windowSeconds: FORGOT_PASSWORD_RULE.windowSeconds,
    });
  });

  it("returns null when the path doesn't match", () => {
    const rule = resolveForgotPasswordRule("/sign-in/email", {
      email: "alice@example.com",
    });
    expect(rule).toBeNull();
  });

  it("returns null when the email is missing or not a string", () => {
    expect(resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, {})).toBeNull();
    expect(
      resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, { email: "" }),
    ).toBeNull();
    expect(
      resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, { email: "   " }),
    ).toBeNull();
    expect(
      resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, { email: 42 }),
    ).toBeNull();
    expect(resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, undefined)).toBeNull();
  });

  it("enforces the configured rate (3 per hour) end-to-end", async () => {
    const { db } = createFakeDB();
    const rule = resolveForgotPasswordRule(FORGOT_PASSWORD_PATH, {
      email: "user@example.com",
    });
    if (!rule) throw new Error("rule should not be null");

    expect(rule.max).toBe(3);
    expect(rule.windowSeconds).toBe(60 * 60);

    const r1 = await applyRateLimit(db, rule, 0);
    const r2 = await applyRateLimit(db, rule, 1_000);
    const r3 = await applyRateLimit(db, rule, 2_000);
    const blocked = await applyRateLimit(db, rule, 3_000);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    expect(blocked.ok).toBe(false);

    // Advance past the 1h window → next call succeeds and counter resets.
    const afterWindow = await applyRateLimit(db, rule, 60 * 60 * 1000 + 3_000);
    expect(afterWindow).toEqual({ ok: true });
  });
});
