import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Env } from "./env";
import { scheduled } from "./index";

vi.mock("./auth", () => ({
  createAuth: vi.fn(),
}));

interface VerificationRow {
  id: string;
  expiresAt: number;
}

interface FakeDB {
  rows: VerificationRow[];
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub recognising only the `delete from "verification"`
 * statement the scheduled handler emits. Throws on any other SQL so a typo
 * fails loudly. `run()` reports `meta.changes` like real D1.
 */
function createFakeDB(initialRows: VerificationRow[]): FakeDB {
  const rows: VerificationRow[] = [...initialRows];

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('delete from "verification"')) {
            const [cutoff] = args as [number];
            const before = rows.length;
            for (let i = rows.length - 1; i >= 0; i--) {
              if (rows[i].expiresAt < cutoff) {
                rows.splice(i, 1);
              }
            }
            return { success: true, meta: { changes: before - rows.length } };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
      };
      return stmt;
    },
  };

  return { rows, db: db as unknown as D1Database };
}

function envWith(db: D1Database): Env {
  return {
    DB: db,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: "test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
    PUBLIC_APP_URL: "http://localhost",
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;

describe("scheduled — verification cleanup cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes tokens expired more than 30 days ago and keeps the rest", async () => {
    const now = Date.now();
    const { rows, db } = createFakeDB([
      { id: "long-expired", expiresAt: now - RETENTION_MS - 10 * DAY_MS },
      { id: "just-past-cutoff", expiresAt: now - RETENTION_MS - 1 },
      { id: "recently-expired", expiresAt: now - DAY_MS },
      { id: "still-valid", expiresAt: now + 10 * DAY_MS },
    ]);

    await scheduled(
      {} as ScheduledController,
      envWith(db),
      {} as ExecutionContext,
    );

    expect(rows.map((r) => r.id).sort()).toEqual([
      "recently-expired",
      "still-valid",
    ]);
  });

  it("logs a structured cleanup event with the removed count", async () => {
    const now = Date.now();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { db } = createFakeDB([
      { id: "a", expiresAt: now - RETENTION_MS - 5 * DAY_MS },
      { id: "b", expiresAt: now - RETENTION_MS - DAY_MS },
      { id: "c", expiresAt: now + DAY_MS },
    ]);

    await scheduled(
      {} as ScheduledController,
      envWith(db),
      {} as ExecutionContext,
    );

    expect(logSpy).toHaveBeenCalledWith({
      event: "verification_cleanup",
      removed: 2,
    });
  });

  it("logs zero removed when nothing has expired past the window", async () => {
    const now = Date.now();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { rows, db } = createFakeDB([
      { id: "valid", expiresAt: now + 5 * DAY_MS },
      { id: "recent", expiresAt: now - DAY_MS },
    ]);

    await scheduled(
      {} as ScheduledController,
      envWith(db),
      {} as ExecutionContext,
    );

    expect(rows).toHaveLength(2);
    expect(logSpy).toHaveBeenCalledWith({
      event: "verification_cleanup",
      removed: 0,
    });
  });
});
