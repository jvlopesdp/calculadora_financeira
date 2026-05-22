import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import paymentsRouter, { type PaymentRow } from "./payments";
import type { ScenarioRow } from "./scenarios";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

interface FakeDB {
  scenarios: ScenarioRow[];
  payments: PaymentRow[];
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub. Recognises the exact SQL the payments router
 * emits (plus the ownership lookup against `financing_scenarios`) and replays
 * against an array of rows. Throws on any other SQL so a typo or missing case
 * fails loudly in tests.
 */
function createFakeDB(opts: {
  scenarios?: ScenarioRow[];
  payments?: PaymentRow[];
} = {}): FakeDB {
  const scenarios: ScenarioRow[] = [...(opts.scenarios ?? [])];
  const payments: PaymentRow[] = [...(opts.payments ?? [])];

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];

      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('insert into "payment_history"')) {
            const [
              id,
              scenario_id,
              reference_month,
              payment_date,
              amount_paid_cents,
              payment_type,
              amortization_strategy,
              notes,
              created_at,
            ] = args as [
              string,
              string,
              string,
              string,
              number,
              string,
              string,
              string | null,
              number,
            ];
            payments.push({
              id,
              scenario_id,
              reference_month,
              payment_date,
              amount_paid_cents,
              payment_type,
              amortization_strategy,
              notes,
              created_at,
            });
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "payment_history" set "reference_month"')) {
            const [reference_month, id, scenario_id] = args as [
              string,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.reference_month = reference_month;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "payment_history" set "payment_date"')) {
            const [payment_date, id, scenario_id] = args as [
              string,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.payment_date = payment_date;
            return { success: true, meta: {} };
          }
          if (
            sql.startsWith('update "payment_history" set "amount_paid_cents"')
          ) {
            const [amount_paid_cents, id, scenario_id] = args as [
              number,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.amount_paid_cents = amount_paid_cents;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "payment_history" set "payment_type"')) {
            const [payment_type, id, scenario_id] = args as [
              string,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.payment_type = payment_type;
            return { success: true, meta: {} };
          }
          if (
            sql.startsWith(
              'update "payment_history" set "amortization_strategy"',
            )
          ) {
            const [amortization_strategy, id, scenario_id] = args as [
              string,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.amortization_strategy = amortization_strategy;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "payment_history" set "notes"')) {
            const [notes, id, scenario_id] = args as [
              string | null,
              string,
              string,
            ];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (row) row.notes = notes;
            return { success: true, meta: {} };
          }
          if (sql.startsWith('delete from "payment_history"')) {
            const [id, scenario_id] = args as [string, string];
            const idx = payments.findIndex(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            if (idx >= 0) payments.splice(idx, 1);
            return { success: true, meta: {} };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
        async first<T = unknown>(): Promise<T | null> {
          if (
            sql.startsWith(
              'select "id" from "financing_scenarios" where "id" = ? and "user_id" = ?',
            )
          ) {
            const [id, user_id] = args as [string, string];
            const row = scenarios.find(
              (s) => s.id === id && s.user_id === user_id,
            );
            return (row ? { id: row.id } : null) as T | null;
          }
          if (
            sql.startsWith(
              'select * from "payment_history" where "id" = ? and "scenario_id" = ?',
            )
          ) {
            const [id, scenario_id] = args as [string, string];
            const row = payments.find(
              (p) => p.id === id && p.scenario_id === scenario_id,
            );
            return (row ?? null) as T | null;
          }
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          if (
            sql.startsWith(
              'select * from "payment_history" where "scenario_id" = ?',
            )
          ) {
            const [scenario_id] = args as [string];
            const results = payments
              .filter((p) => p.scenario_id === scenario_id)
              .slice()
              .sort((a, b) =>
                a.reference_month < b.reference_month
                  ? -1
                  : a.reference_month > b.reference_month
                    ? 1
                    : 0,
              );
            return { results: results as unknown as T[] };
          }
          throw new Error(`Unhandled SQL (all): ${sql}`);
        },
      };
      return stmt;
    },
  };

  return {
    scenarios,
    payments,
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
  app.route("/api/scenarios/:scenarioId/payments", paymentsRouter);
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
  };
}

function scenarioOf(
  id: string,
  user_id: string,
  overrides: Partial<ScenarioRow> = {},
): ScenarioRow {
  return {
    id,
    user_id,
    name: `Scenario ${id}`,
    property_value_cents: 50_000_000,
    down_payment_cents: 10_000_000,
    term_months: 360,
    annual_rate_basis_points: 850,
    start_date: "2026-01-01",
    created_at: Date.now(),
    archived_at: null,
    ...overrides,
  };
}

function paymentOf(
  id: string,
  scenario_id: string,
  overrides: Partial<PaymentRow> = {},
): PaymentRow {
  return {
    id,
    scenario_id,
    reference_month: "2026-01",
    payment_date: "2026-01-15",
    amount_paid_cents: 350_000,
    payment_type: "parcela",
    amortization_strategy: "prazo",
    notes: null,
    created_at: Date.now(),
    ...overrides,
  };
}

const cookie = "better-auth.session_token=valid";

const validBody = {
  referenceMonth: "2026-02",
  paymentDate: "2026-02-15",
  amountPaid: 3_500.55,
  paymentType: "parcela",
  amortizationStrategy: "prazo",
};

describe("payments router", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  describe("auth", () => {
    it("returns 401 when there is no session", async () => {
      mockedCreateAuth.mockReturnValue({
        api: { getSession: async () => null },
      } as unknown as ReturnType<typeof createAuth>);

      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
      app.route("/api/scenarios/:scenarioId/payments", paymentsRouter);

      const res = await app.request(
        "/api/scenarios/s1/payments",
        { method: "GET" },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });
  });

  describe("POST /api/scenarios/:scenarioId/payments", () => {
    it("creates a payment, stores money in cents, returns 201", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { payment: PaymentRow };
      expect(body.payment).toMatchObject({
        scenario_id: "s1",
        reference_month: "2026-02",
        payment_date: "2026-02-15",
        amount_paid_cents: 350_055,
        payment_type: "parcela",
        amortization_strategy: "prazo",
        notes: null,
      });
      expect(typeof body.payment.id).toBe("string");
      expect(body.payment.id.length).toBeGreaterThan(0);
      expect(payments).toHaveLength(1);
    });

    it("stores notes when provided", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, notes: "Décimo terceiro" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(201);
      expect(payments[0]?.notes).toBe("Décimo terceiro");
    });

    it("returns 404 when scenario belongs to another user", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-B")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
      expect(payments).toHaveLength(0);
    });

    it("returns 404 when scenario does not exist", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/missing/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("rejects malformed JSON with 400", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
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

    it("rejects bad referenceMonth format", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, referenceMonth: "2026-13" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: string;
        issues: { message: string }[];
      };
      expect(body.error).toBe("validation");
      expect(body.issues[0]?.message).toMatch(/Mês de referência/);
    });

    it("rejects bad paymentDate format", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, paymentDate: "15/02/2026" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
    });

    it("rejects unknown paymentType", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, paymentType: "outro" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
    });

    it("rejects unknown amortizationStrategy", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...validBody,
            amortizationStrategy: "nope",
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
    });

    it("rejects non-positive amountPaid", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, amountPaid: 0 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/scenarios/:scenarioId/payments", () => {
    it("lists payments for the scenario in ascending reference_month", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [
          paymentOf("p2", "s1", { reference_month: "2026-03" }),
          paymentOf("p1", "s1", { reference_month: "2026-01" }),
          paymentOf("p3", "s1", { reference_month: "2026-02" }),
        ],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { payments: PaymentRow[] };
      expect(body.payments.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
    });

    it("returns 404 when scenario belongs to another user", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-B")],
        payments: [paymentOf("p1", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns an empty array when there are no payments", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ payments: [] });
    });
  });

  describe("PATCH /api/scenarios/:scenarioId/payments/:pid", () => {
    it("updates a single field (amountPaid)", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [paymentOf("p1", "s1", { amount_paid_cents: 350_000 })],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ amountPaid: 4_000 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { payment: PaymentRow };
      expect(body.payment.amount_paid_cents).toBe(400_000);
      expect(payments[0]?.amount_paid_cents).toBe(400_000);
    });

    it("updates multiple fields at once", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [paymentOf("p1", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            referenceMonth: "2026-04",
            paymentDate: "2026-04-10",
            paymentType: "amortizacao_extra",
            amortizationStrategy: "parcela",
            notes: "Bônus",
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { payment: PaymentRow };
      expect(body.payment).toMatchObject({
        reference_month: "2026-04",
        payment_date: "2026-04-10",
        payment_type: "amortizacao_extra",
        amortization_strategy: "parcela",
        notes: "Bônus",
      });
      expect(payments[0]?.reference_month).toBe("2026-04");
      expect(payments[0]?.notes).toBe("Bônus");
    });

    it("clears notes when notes=null", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [paymentOf("p1", "s1", { notes: "old" })],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ notes: null }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(payments[0]?.notes).toBeNull();
    });

    it("rejects an empty patch body", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [paymentOf("p1", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("returns 404 when payment belongs to another scenario", async () => {
      const { db } = createFakeDB({
        scenarios: [
          scenarioOf("s1", "user-A"),
          scenarioOf("s2", "user-A"),
        ],
        payments: [paymentOf("p1", "s2")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ amountPaid: 1 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when scenario belongs to another user (cross-ownership)", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-B")],
        payments: [paymentOf("p1", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ amountPaid: 1 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(payments[0]?.amount_paid_cents).toBe(350_000);
    });

    it("returns 404 for unknown payment id", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/missing",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ amountPaid: 1 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/scenarios/:scenarioId/payments/:pid", () => {
    it("removes the payment", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
        payments: [paymentOf("p1", "s1"), paymentOf("p2", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { payment: PaymentRow };
      expect(body.payment.id).toBe("p1");
      expect(payments.map((p) => p.id)).toEqual(["p2"]);
    });

    it("returns 404 for unknown id", async () => {
      const { db } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-A")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/missing",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when scenario belongs to another user", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [scenarioOf("s1", "user-B")],
        payments: [paymentOf("p1", "s1")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(payments).toHaveLength(1);
    });

    it("returns 404 when payment belongs to a different scenario than the URL", async () => {
      const { db, payments } = createFakeDB({
        scenarios: [
          scenarioOf("s1", "user-A"),
          scenarioOf("s2", "user-A"),
        ],
        payments: [paymentOf("p1", "s2")],
      });
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/s1/payments/p1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(payments).toHaveLength(1);
    });
  });
});
