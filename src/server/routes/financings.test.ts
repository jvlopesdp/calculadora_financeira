/**
 * Integration smoke for the unified "Meus Financiamentos" resource (US-007).
 * Mounts the plans + entries routers on a single Hono app — matching the
 * wiring in `src/server/index.ts` — and exercises create / list / upsert /
 * delete on both layers in one walking flow, using the same fake-D1 stub
 * the per-router tests use. The per-router test files retain their fine-
 * grained validation/ownership coverage; this file documents the canonical
 * end-to-end CRUD shape and ensures the two routers compose correctly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import trackerEntriesRouter from "./tracker-entries";
import trackerPlansRouter, {
  type TrackerEntryRow,
  type TrackerPlanRow,
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
 * In-memory D1 stub covering the SQL shapes both unified routers emit. Throws
 * on any other SQL so a typo or missing case fails loudly. The
 * `insert into "tracker_entries"` branch mimics the `on conflict (plan_id,
 * month_index)` upsert by updating in place (preserving id + created_at).
 */
function createFakeDB(): FakeDB {
  const plans: TrackerPlanRow[] = [];
  const entries: TrackerEntryRow[] = [];

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
          if (sql.startsWith('delete from "tracker_plans"')) {
            const [id, user_id] = args as [string, string];
            const idx = plans.findIndex(
              (p) => p.id === id && p.user_id === user_id,
            );
            if (idx !== -1) {
              plans.splice(idx, 1);
              for (let i = entries.length - 1; i >= 0; i--) {
                if (entries[i]?.plan_id === id) entries.splice(i, 1);
              }
            }
            return { success: true, meta: {} };
          }
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
          if (
            sql.startsWith('select * from "tracker_plans" where "user_id" = ?')
          ) {
            const [user_id] = args as [string];
            const results = plans
              .filter((p) => p.user_id === user_id)
              .slice()
              .sort((a, b) => b.created_at - a.created_at);
            return { results: results as unknown as T[] };
          }
          if (
            sql.startsWith('select * from "tracker_entries" where "plan_id" = ?')
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

  return { plans, entries, db: db as unknown as D1Database };
}

function buildUnifiedApp(userId: string) {
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
  // Mount order mirrors `src/server/index.ts`: the nested entries route
  // registers BEFORE the plans route so its more specific path wins.
  app.route("/api/tracker/plans/:planId/entries", trackerEntriesRouter);
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

const validPlanBody = {
  name: "Apto SP",
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  annualRate: 8.5,
  modality: "PRICE" as const,
  startDate: "2026-01-01",
  targetMonthlyTotal: 5_000,
};

// PRICE installment for the body above sits ~R$ 2,988. 5_000 is comfortably
// above so we can use it as a valid paid_amount without pinning the value.
const ABOVE_INSTALLMENT = 5_000;

describe("unified financings resource (plans + entries)", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  it("walks the canonical CRUD: create plan → list → upsert entry (twice) → read detail → delete entry → delete plan", async () => {
    const { db, plans, entries } = createFakeDB();
    const { app, fakeUser } = buildUnifiedApp("user-A");
    const env = envWith(db);

    // 1. CREATE a plan.
    const createRes = await app.request(
      "/api/tracker/plans",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(validPlanBody),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const { plan } = (await createRes.json()) as { plan: TrackerPlanRow };
    expect(plan.user_id).toBe(fakeUser.id);
    expect(plan.modality).toBe("PRICE");
    expect(plans).toHaveLength(1);

    // 2. LIST returns the freshly created plan.
    const listRes = await app.request(
      "/api/tracker/plans",
      { method: "GET", headers: { cookie } },
      env,
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { plans: TrackerPlanRow[] };
    expect(listBody.plans.map((p) => p.id)).toEqual([plan.id]);

    // 3. UPSERT an entry for month 1.
    const upsertRes = await app.request(
      `/api/tracker/plans/${plan.id}/entries`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          month_index: 1,
          paid_amount: ABOVE_INSTALLMENT,
          paid_at: "2026-02-01",
          apply_mode: "reduce_term",
        }),
      },
      env,
    );
    expect(upsertRes.status).toBe(200);
    const { entry: firstEntry } = (await upsertRes.json()) as {
      entry: TrackerEntryRow;
    };
    expect(firstEntry.month_index).toBe(1);
    expect(firstEntry.apply_mode).toBe("reduce_term");
    expect(entries).toHaveLength(1);

    // 4. UPSERT again for the same month → updates in place (id preserved).
    const upsertAgainRes = await app.request(
      `/api/tracker/plans/${plan.id}/entries`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          month_index: 1,
          paid_amount: ABOVE_INSTALLMENT,
          paid_at: "2026-02-01",
          apply_mode: "reduce_installment",
        }),
      },
      env,
    );
    expect(upsertAgainRes.status).toBe(200);
    const { entry: upsertedEntry } = (await upsertAgainRes.json()) as {
      entry: TrackerEntryRow;
    };
    expect(upsertedEntry.id).toBe(firstEntry.id);
    expect(upsertedEntry.apply_mode).toBe("reduce_installment");
    expect(entries).toHaveLength(1);

    // 5. READ detail returns plan + entries.
    const detailRes = await app.request(
      `/api/tracker/plans/${plan.id}`,
      { method: "GET", headers: { cookie } },
      env,
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      plan: TrackerPlanRow;
      entries: TrackerEntryRow[];
    };
    expect(detail.plan.id).toBe(plan.id);
    expect(detail.entries.map((e) => e.id)).toEqual([upsertedEntry.id]);

    // 6. DELETE the entry.
    const deleteEntryRes = await app.request(
      `/api/tracker/plans/${plan.id}/entries/${upsertedEntry.id}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteEntryRes.status).toBe(200);
    expect(entries).toHaveLength(0);

    // 7. DELETE the plan.
    const deletePlanRes = await app.request(
      `/api/tracker/plans/${plan.id}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deletePlanRes.status).toBe(200);
    expect(plans).toHaveLength(0);

    // 8. Subsequent LIST is empty.
    const finalListRes = await app.request(
      "/api/tracker/plans",
      { method: "GET", headers: { cookie } },
      env,
    );
    expect(finalListRes.status).toBe(200);
    expect(await finalListRes.json()).toEqual({ plans: [] });
  });

  it("cascade: deleting the plan also removes its entries via the unified resource", async () => {
    const { db, plans, entries } = createFakeDB();
    const { app } = buildUnifiedApp("user-A");
    const env = envWith(db);

    const createRes = await app.request(
      "/api/tracker/plans",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(validPlanBody),
      },
      env,
    );
    const { plan } = (await createRes.json()) as { plan: TrackerPlanRow };

    await app.request(
      `/api/tracker/plans/${plan.id}/entries`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          month_index: 1,
          paid_amount: ABOVE_INSTALLMENT,
          paid_at: "2026-02-01",
          apply_mode: "reduce_term",
        }),
      },
      env,
    );
    expect(entries).toHaveLength(1);

    const deleteRes = await app.request(
      `/api/tracker/plans/${plan.id}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );

    expect(deleteRes.status).toBe(200);
    expect(plans).toHaveLength(0);
    expect(entries).toHaveLength(0);
  });
});
