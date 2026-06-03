import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import trackerPlansRouter, {
  type TrackerPlanRow,
  type TrackerEntryRow,
} from "./tracker-plans";

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
 * Minimal in-memory D1 stub. Recognises the exact SQL shapes the tracker-plans
 * router emits and replays them against arrays of rows. Throws on any other SQL
 * so a typo or missing case fails loudly in tests.
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
          if (sql.startsWith('insert into "tracker_plans"')) {
            const [
              id,
              user_id,
              name,
              property_value_cents,
              down_payment_cents,
              term_months,
              annual_rate_bp,
              modality,
              start_date,
              target_monthly_total_cents,
              created_at,
              updated_at,
            ] = args as [
              string,
              string,
              string,
              number,
              number,
              number,
              number,
              "PRICE" | "SAC",
              string,
              number,
              number,
              number,
            ];
            plans.push({
              id,
              user_id,
              name,
              property_value_cents,
              down_payment_cents,
              term_months,
              annual_rate_bp,
              modality,
              start_date,
              target_monthly_total_cents,
              created_at,
              updated_at,
            });
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "tracker_plans" set "name"')) {
            const [name, updated_at, id, user_id] = args as [
              string,
              number,
              string,
              string,
            ];
            const plan = plans.find(
              (p) => p.id === id && p.user_id === user_id,
            );
            if (plan) {
              plan.name = name;
              plan.updated_at = updated_at;
            }
            return { success: true, meta: {} };
          }
          if (
            sql.startsWith(
              'update "tracker_plans" set "target_monthly_total_cents"',
            )
          ) {
            const [cents, updated_at, id, user_id] = args as [
              number,
              number,
              string,
              string,
            ];
            const plan = plans.find(
              (p) => p.id === id && p.user_id === user_id,
            );
            if (plan) {
              plan.target_monthly_total_cents = cents;
              plan.updated_at = updated_at;
            }
            return { success: true, meta: {} };
          }
          if (sql.startsWith('delete from "tracker_plans"')) {
            const [id, user_id] = args as [string, string];
            const idx = plans.findIndex(
              (p) => p.id === id && p.user_id === user_id,
            );
            if (idx !== -1) {
              plans.splice(idx, 1);
              // Mimic the ON DELETE CASCADE on tracker_entries.
              for (let i = entries.length - 1; i >= 0; i--) {
                if (entries[i]?.plan_id === id) {
                  entries.splice(i, 1);
                }
              }
            }
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
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          if (
            sql.startsWith(
              'select * from "tracker_plans" where "user_id" = ?',
            )
          ) {
            const [user_id] = args as [string];
            const results = plans
              .filter((p) => p.user_id === user_id)
              .slice()
              .sort((a, b) => b.created_at - a.created_at);
            return { results: results as unknown as T[] };
          }
          if (
            sql.startsWith(
              'select * from "tracker_entries" where "plan_id" = ?',
            )
          ) {
            const [plan_id] = args as [string];
            const results = entries
              .filter((e) => e.plan_id === plan_id)
              .slice()
              .sort((a, b) => a.month_index - b.month_index);
            return { results: results as unknown as T[] };
          }
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
  app.route("/api/tracker/plans", trackerPlansRouter);
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

const validBody = {
  name: "Meu plano",
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  annualRate: 8.5,
  modality: "PRICE" as const,
  startDate: "2026-01-01",
  targetMonthlyTotal: 5_000,
};

describe("tracker-plans router", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  describe("auth", () => {
    it("returns 401 when there is no session", async () => {
      mockedCreateAuth.mockReturnValue({
        api: { getSession: async () => null },
      } as unknown as ReturnType<typeof createAuth>);

      const { db } = createFakeDB();
      const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
      app.route("/api/tracker/plans", trackerPlansRouter);

      const res = await app.request(
        "/api/tracker/plans",
        { method: "GET" },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });
  });

  describe("POST /api/tracker/plans", () => {
    it("creates a plan, stores money in cents/bp, returns 201", async () => {
      const { db, plans } = createFakeDB();
      const { app, fakeUser } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { plan: TrackerPlanRow };
      expect(body.plan).toMatchObject({
        user_id: fakeUser.id,
        name: "Meu plano",
        property_value_cents: 50_000_000,
        down_payment_cents: 10_000_000,
        term_months: 360,
        annual_rate_bp: 850,
        modality: "PRICE",
        start_date: "2026-01-01",
        target_monthly_total_cents: 500_000,
      });
      expect(typeof body.plan.id).toBe("string");
      expect(body.plan.id.length).toBeGreaterThan(0);
      expect(body.plan.created_at).toBe(body.plan.updated_at);
      expect(plans).toHaveLength(1);
      expect(plans[0]?.user_id).toBe(fakeUser.id);
    });

    it("rejects malformed JSON with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
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

    it("rejects missing required fields with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "x" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("rejects an invalid modality with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, modality: "FANCY" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
    });

    it("rejects downPayment >= propertyValue with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, downPayment: 500_000 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("validation");
      expect(body.message).toBe(
        "down_payment_must_be_less_than_property_value",
      );
    });

    it("rejects a non-positive targetMonthlyTotal with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, targetMonthlyTotal: 0 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/tracker/plans", () => {
    it("returns only the user's plans, newest first", async () => {
      const now = Date.now();
      const { db } = createFakeDB([
        planOf("a1", "user-A", { created_at: now - 1000 }),
        planOf("a2", "user-A", { created_at: now }),
        planOf("b1", "user-B", { created_at: now }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { plans: TrackerPlanRow[] };
      expect(body.plans.map((p) => p.id)).toEqual(["a2", "a1"]);
    });

    it("returns an empty array when the user has no plans", async () => {
      const { db } = createFakeDB([planOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ plans: [] });
    });
  });

  describe("GET /api/tracker/plans/:id", () => {
    it("returns the plan with its entries when it belongs to the user", async () => {
      const { db } = createFakeDB(
        [planOf("a1", "user-A")],
        [entryOf("e1", "a1", 1), entryOf("e2", "a1", 2)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        plan: TrackerPlanRow;
        entries: TrackerEntryRow[];
      };
      expect(body.plan.id).toBe("a1");
      expect(body.entries.map((e) => e.month_index)).toEqual([1, 2]);
    });

    it("returns an empty entries array when there are none", async () => {
      const { db } = createFakeDB([planOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entries: TrackerEntryRow[] };
      expect(body.entries).toEqual([]);
    });

    it("returns 404 when the id does not exist", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/missing",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    });

    it("returns 404 when the plan belongs to another user (ownership)", async () => {
      const { db } = createFakeDB([planOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/b1",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/tracker/plans/:id", () => {
    it("updates name and target_monthly_total only", async () => {
      const { db, plans } = createFakeDB([
        planOf("a1", "user-A", {
          name: "Old",
          target_monthly_total_cents: 500_000,
          term_months: 360,
        }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "New", targetMonthlyTotal: 6_000 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { plan: TrackerPlanRow };
      expect(body.plan.name).toBe("New");
      expect(body.plan.target_monthly_total_cents).toBe(600_000);
      expect(plans[0]?.name).toBe("New");
      expect(plans[0]?.target_monthly_total_cents).toBe(600_000);
      // Immutable fields preserved.
      expect(plans[0]?.term_months).toBe(360);
    });

    it("ignores immutable fields (termMonths is not editable)", async () => {
      const { db, plans } = createFakeDB([
        planOf("a1", "user-A", { term_months: 360 }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "Renamed", termMonths: 12 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(plans[0]?.term_months).toBe(360);
      expect(plans[0]?.name).toBe("Renamed");
    });

    it("rejects an empty body with 422", async () => {
      const { db } = createFakeDB([planOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("returns 404 when the plan belongs to another user", async () => {
      const { db } = createFakeDB([planOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/b1",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "hijack" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tracker/plans/:id", () => {
    it("removes the plan and cascades its entries", async () => {
      const { db, plans, entries } = createFakeDB(
        [planOf("a1", "user-A")],
        [entryOf("e1", "a1", 1)],
      );
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/a1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { plan: TrackerPlanRow };
      expect(body.plan.id).toBe("a1");
      expect(plans).toHaveLength(0);
      expect(entries).toHaveLength(0);
    });

    it("returns 404 for an unknown id", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/missing",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when the plan belongs to another user", async () => {
      const { db, plans } = createFakeDB([planOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/tracker/plans/b1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(plans).toHaveLength(1);
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
