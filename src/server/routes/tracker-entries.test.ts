import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import trackerEntriesRouter from "./tracker-entries";
import type { TrackerEntryRow, TrackerPlanRow } from "./tracker-plans";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

interface FakeDB {
  plans: TrackerPlanRow[];
  entries: TrackerEntryRow[];
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub. Recognises the exact SQL shapes the tracker-entries
 * router emits and replays them against arrays of rows. Throws on any other SQL
 * so a typo or missing case fails loudly in tests. The `insert into
 * "tracker_entries"` branch mimics the `on conflict (plan_id, month_index)`
 * upsert: it updates the matching row in place (keeping id + created_at) or
 * appends a new one.
 */
function createFakeDB(
  initialPlans: TrackerPlanRow[] = [],
  initialEntries: TrackerEntryRow[] = [],
): FakeDB {
  const plans: TrackerPlanRow[] = [...initialPlans];
  const entries: TrackerEntryRow[] = [...initialEntries];

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];

      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('insert into "tracker_entries"')) {
            const [
              id,
              plan_id,
              month_index,
              paid_amount_cents,
              paid_at,
              apply_mode,
              note,
              created_at,
            ] = args as [
              string,
              string,
              number,
              number,
              string,
              "reduce_term" | "reduce_installment",
              string | null,
              number,
            ];
            const existing = entries.find(
              (e) => e.plan_id === plan_id && e.month_index === month_index,
            );
            if (existing) {
              existing.paid_amount_cents = paid_amount_cents;
              existing.paid_at = paid_at;
              existing.apply_mode = apply_mode;
              existing.note = note;
            } else {
              entries.push({
                id,
                plan_id,
                month_index,
                paid_amount_cents,
                paid_at,
                apply_mode,
                note,
                created_at,
              });
            }
            return { success: true, meta: {} };
          }
          if (
            sql.startsWith('update "tracker_entries" set "paid_amount_cents"')
          ) {
            const [paid_amount_cents, id, plan_id] = args as [
              number,
              string,
              string,
            ];
            const entry = entries.find(
              (e) => e.id === id && e.plan_id === plan_id,
            );
            if (entry) entry.paid_amount_cents = paid_amount_cents;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "tracker_entries" set "apply_mode"')) {
            const [apply_mode, id, plan_id] = args as [
              "reduce_term" | "reduce_installment",
              string,
              string,
            ];
            const entry = entries.find(
              (e) => e.id === id && e.plan_id === plan_id,
            );
            if (entry) entry.apply_mode = apply_mode;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "tracker_entries" set "note"')) {
            const [note, id, plan_id] = args as [string | null, string, string];
            const entry = entries.find(
              (e) => e.id === id && e.plan_id === plan_id,
            );
            if (entry) entry.note = note;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('delete from "tracker_entries"')) {
            const [id, plan_id] = args as [string, string];
            const idx = entries.findIndex(
              (e) => e.id === id && e.plan_id === plan_id,
            );
            if (idx !== -1) entries.splice(idx, 1);
            return { success: true, meta: {} };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
        async first<T = unknown>(): Promise<T | null> {
          if (
            sql.startsWith(
              'select * from "tracker_plans" where "id" = ? and "user_id" = ?',
            )
          ) {
            const [id, user_id] = args as [string, string];
            const plan = plans.find(
              (p) => p.id === id && p.user_id === user_id,
            );
            return (plan ?? null) as T | null;
          }
          if (
            sql.startsWith(
              'select * from "tracker_entries" where "plan_id" = ? and "month_index" = ?',
            )
          ) {
            const [plan_id, month_index] = args as [string, number];
            const entry = entries.find(
              (e) => e.plan_id === plan_id && e.month_index === month_index,
            );
            return (entry ?? null) as T | null;
          }
          if (
            sql.startsWith(
              'select * from "tracker_entries" where "id" = ? and "plan_id" = ?',
            )
          ) {
            const [id, plan_id] = args as [string, string];
            const entry = entries.find(
              (e) => e.id === id && e.plan_id === plan_id,
            );
            return (entry ?? null) as T | null;
          }
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          throw new Error(`Unhandled SQL (all): ${sql}`);
        },
      };
      return stmt;
    },
  };

  return {
    plans,
    entries,
    db: db as unknown as D1Database,
  };
}

function buildApp(userId: string) {
  const fakeUser = {
    id: userId,
    email: `${userId}@example.com`,
    name: userId,
  };
  const fakeSession = {
    id: `sess-${userId}`,
    token: `tok-${userId}`,
    expiresAt: new Date(Date.now() + 86_400_000),
  };

  mockedCreateAuth.mockReturnValue({
    api: {
      getSession: async () => ({ user: fakeUser, session: fakeSession }),
    },
  } as unknown as ReturnType<typeof createAuth>);

  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.route("/api/tracker/plans/:planId/entries", trackerEntriesRouter);
  return { app, fakeUser };
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

const cookie = "better-auth.session_token=valid";

// PRICE installment for a 400k principal / 360 months / 8.5%/yr plan is roughly
// R$ 2,988. The tests use thresholds well below/above this so the exact value
// never needs to be pinned.
const BELOW_INSTALLMENT = 1_000;
const ABOVE_INSTALLMENT = 5_000;

const validEntryBody = {
  month_index: 1,
  paid_amount: ABOVE_INSTALLMENT,
  paid_at: "2026-02-01",
  apply_mode: "reduce_term" as const,
};

describe("tracker-entries router", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  describe("auth", () => {
    it("returns 401 when there is no session", async () => {
      mockedCreateAuth.mockReturnValue({
        api: { getSession: async () => null },
      } as unknown as ReturnType<typeof createAuth>);

      const { db } = createFakeDB([planOf("p1", "user-A")]);
      const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
      app.route("/api/tracker/plans/:planId/entries", trackerEntriesRouter);

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validEntryBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });
  });

  describe("POST /api/tracker/plans/:planId/entries", () => {
    it("creates an entry and converts BRL to cents (200)", async () => {
      const { db, entries } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validEntryBody, note: "extra" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: TrackerEntryRow };
      expect(body.entry).toMatchObject({
        plan_id: "p1",
        month_index: 1,
        paid_amount_cents: ABOVE_INSTALLMENT * 100,
        paid_at: "2026-02-01",
        apply_mode: "reduce_term",
        note: "extra",
      });
      expect(entries).toHaveLength(1);
    });

    it("upserts when an entry already exists for the same month", async () => {
      const { db, entries } = createFakeDB(
        [planOf("p1", "user-A")],
        [entryOf("e1", "p1", 1, { paid_amount_cents: 300_000 })],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...validEntryBody,
            apply_mode: "reduce_installment",
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: TrackerEntryRow };
      // Same row updated in place (id preserved), not a second row inserted.
      expect(entries).toHaveLength(1);
      expect(body.entry.id).toBe("e1");
      expect(body.entry.paid_amount_cents).toBe(ABOVE_INSTALLMENT * 100);
      expect(body.entry.apply_mode).toBe("reduce_installment");
    });

    it("rejects malformed JSON with 400", async () => {
      const { db } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: "{not json",
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_json" });
    });

    it("rejects an invalid apply_mode with 422", async () => {
      const { db } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validEntryBody, apply_mode: "nope" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("rejects a month_index above term_months with 422", async () => {
      const { db } = createFakeDB([
        planOf("p1", "user-A", { term_months: 360 }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validEntryBody, month_index: 361 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("validation");
      expect(body.message).toContain("entre 1 e 360");
    });

    it("rejects a payment below the month's installment with 422", async () => {
      const { db, entries } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...validEntryBody,
            paid_amount: BELOW_INSTALLMENT,
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("validation");
      expect(body.message).toContain("parcela prevista");
      expect(entries).toHaveLength(0);
    });

    it("returns 404 when the plan does not exist", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/missing/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validEntryBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    });

    it("returns 404 when the plan belongs to another user (ownership)", async () => {
      const { db } = createFakeDB([planOf("p1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validEntryBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/tracker/plans/:planId/entries/:entryId", () => {
    it("updates paid_amount, apply_mode and note (200)", async () => {
      const { db, entries } = createFakeDB(
        [planOf("p1", "user-A")],
        [entryOf("e1", "p1", 2, { apply_mode: "reduce_term", note: null })],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            paid_amount: ABOVE_INSTALLMENT,
            apply_mode: "reduce_installment",
            note: "updated",
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: TrackerEntryRow };
      expect(body.entry.paid_amount_cents).toBe(ABOVE_INSTALLMENT * 100);
      expect(body.entry.apply_mode).toBe("reduce_installment");
      expect(body.entry.note).toBe("updated");
      // month_index untouched.
      expect(entries[0]?.month_index).toBe(2);
    });

    it("rejects an empty body with 422", async () => {
      const { db } = createFakeDB(
        [planOf("p1", "user-A")],
        [entryOf("e1", "p1", 1)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("rejects a paid_amount below the installment with 422", async () => {
      const { db, entries } = createFakeDB(
        [planOf("p1", "user-A")],
        [entryOf("e1", "p1", 1, { paid_amount_cents: ABOVE_INSTALLMENT * 100 })],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ paid_amount: BELOW_INSTALLMENT }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("validation");
      expect(body.message).toContain("parcela prevista");
      // Unchanged.
      expect(entries[0]?.paid_amount_cents).toBe(ABOVE_INSTALLMENT * 100);
    });

    it("returns 404 when the entry does not exist", async () => {
      const { db } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/missing",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ note: "x" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when the plan belongs to another user", async () => {
      const { db } = createFakeDB(
        [planOf("p1", "user-B")],
        [entryOf("e1", "p1", 1)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ note: "hijack" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tracker/plans/:planId/entries/:entryId", () => {
    it("removes the entry (200)", async () => {
      const { db, entries } = createFakeDB(
        [planOf("p1", "user-A")],
        [entryOf("e1", "p1", 1), entryOf("e2", "p1", 2)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: TrackerEntryRow };
      expect(body.entry.id).toBe("e1");
      expect(entries.map((e) => e.id)).toEqual(["e2"]);
    });

    it("returns 404 for an unknown entry id", async () => {
      const { db } = createFakeDB([planOf("p1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/missing",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when the plan belongs to another user", async () => {
      const { db, entries } = createFakeDB(
        [planOf("p1", "user-B")],
        [entryOf("e1", "p1", 1)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/p1/entries/e1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(entries).toHaveLength(1);
    });
  });
});

function planOf(
  id: string,
  user_id: string,
  overrides: Partial<TrackerPlanRow> = {},
): TrackerPlanRow {
  const now = Date.now();
  return {
    id,
    user_id,
    name: `Plano ${id}`,
    property_value_cents: 50_000_000,
    down_payment_cents: 10_000_000,
    term_months: 360,
    annual_rate_bp: 850,
    modality: "PRICE",
    start_date: "2026-01-01",
    target_monthly_total_cents: 500_000,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function entryOf(
  id: string,
  plan_id: string,
  month_index: number,
  overrides: Partial<TrackerEntryRow> = {},
): TrackerEntryRow {
  return {
    id,
    plan_id,
    month_index,
    paid_amount_cents: 400_000,
    paid_at: "2026-02-01",
    apply_mode: "reduce_term",
    note: null,
    created_at: Date.now(),
    ...overrides,
  };
}
