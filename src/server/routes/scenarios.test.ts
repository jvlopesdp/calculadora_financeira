import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import scenariosRouter, { type ScenarioRow } from "./scenarios";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

interface DraftRow {
  payload: string;
  updated_at: number;
}

interface FakeDB {
  rows: ScenarioRow[];
  drafts: Map<string, DraftRow>;
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub. Recognises the exact SQL shapes the scenarios
 * router emits and replays them against an array of rows. Throws on any other
 * SQL so a typo or missing case fails loudly in tests.
 */
function createFakeDB(initialRows: ScenarioRow[] = []): FakeDB {
  const rows: ScenarioRow[] = [...initialRows];
  const drafts = new Map<string, DraftRow>();

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];

      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('insert into "financing_scenarios"')) {
            const [
              id,
              user_id,
              name,
              property_value_cents,
              down_payment_cents,
              term_months,
              annual_rate_basis_points,
              start_date,
              created_at,
              archived_at,
            ] = args as [
              string,
              string,
              string | null,
              number,
              number,
              number,
              number,
              string,
              number,
              number | null,
            ];
            rows.push({
              id,
              user_id,
              name,
              property_value_cents,
              down_payment_cents,
              term_months,
              annual_rate_basis_points,
              start_date,
              created_at,
              archived_at,
            });
            return { success: true, meta: {} };
          }
          if (sql.startsWith('update "financing_scenarios" set "name"')) {
            const [name, id, user_id] = args as [string, string, string];
            const row = rows.find(
              (r) => r.id === id && r.user_id === user_id,
            );
            if (row) {
              row.name = name;
            }
            return { success: true, meta: {} };
          }
          if (
            sql.startsWith('update "financing_scenarios" set "archived_at"')
          ) {
            const [archivedAt, id, user_id] = args as [
              number | null,
              string,
              string,
            ];
            const row = rows.find(
              (r) => r.id === id && r.user_id === user_id,
            );
            if (row) {
              row.archived_at = archivedAt;
            }
            return { success: true, meta: {} };
          }
          if (sql.startsWith('insert into "scenario_drafts"')) {
            const [user_id, payload, updated_at] = args as [
              string,
              string,
              number,
            ];
            drafts.set(user_id, { payload, updated_at });
            return { success: true, meta: {} };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
        async first<T = unknown>(): Promise<T | null> {
          if (
            sql.startsWith(
              'select * from "financing_scenarios" where "id" = ? and "user_id" = ?',
            )
          ) {
            const [id, user_id] = args as [string, string];
            const row = rows.find(
              (r) => r.id === id && r.user_id === user_id,
            );
            return (row ?? null) as T | null;
          }
          if (sql.startsWith('select "payload" from "scenario_drafts"')) {
            const [user_id] = args as [string];
            const draft = drafts.get(user_id);
            return (draft ? { payload: draft.payload } : null) as T | null;
          }
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          if (sql.includes('"archived_at" is null')) {
            const [user_id] = args as [string];
            const results = rows
              .filter((r) => r.user_id === user_id && r.archived_at === null)
              .slice()
              .sort((a, b) => b.created_at - a.created_at);
            return { results: results as unknown as T[] };
          }
          if (
            sql.startsWith(
              'select * from "financing_scenarios" where "user_id" = ?',
            )
          ) {
            const [user_id] = args as [string];
            const results = rows
              .filter((r) => r.user_id === user_id)
              .slice()
              .sort((a, b) => b.created_at - a.created_at);
            return { results: results as unknown as T[] };
          }
          throw new Error(`Unhandled SQL (all): ${sql}`);
        },
      };
      return stmt;
    },
  };

  return {
    rows,
    drafts,
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
  app.route("/api/scenarios", scenariosRouter);
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

const cookie = "better-auth.session_token=valid";

const validBody = {
  name: "Meu apartamento",
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  annualRate: 8.5,
  startDate: "2026-01-01",
};

describe("scenarios router", () => {
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
      app.route("/api/scenarios", scenariosRouter);

      const res = await app.request(
        "/api/scenarios",
        { method: "GET" },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });
  });

  describe("POST /api/scenarios", () => {
    it("creates a scenario, stores money in cents/bp, returns 201", async () => {
      const { db, rows } = createFakeDB();
      const { app, fakeUser } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(validBody),
        },
        envWith(db),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(body.scenario).toMatchObject({
        user_id: fakeUser.id,
        name: "Meu apartamento",
        property_value_cents: 50_000_000,
        down_payment_cents: 10_000_000,
        term_months: 360,
        annual_rate_basis_points: 850,
        start_date: "2026-01-01",
        archived_at: null,
      });
      expect(typeof body.scenario.id).toBe("string");
      expect(body.scenario.id.length).toBeGreaterThan(0);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.user_id).toBe(fakeUser.id);
      expect(rows[0]?.property_value_cents).toBe(50_000_000);
    });

    it("rejects malformed JSON with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
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

    it("rejects missing required fields with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "x" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("rejects downPayment >= propertyValue with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...validBody,
            downPayment: 500_000,
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("validation");
      expect(body.message).toBe(
        "down_payment_must_be_less_than_property_value",
      );
    });

    it("rejects malformed startDate with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...validBody,
            startDate: "01/01/2026",
          }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/scenarios", () => {
    it("returns only the user's non-archived scenarios, newest first", async () => {
      const now = Date.now();
      const { db } = createFakeDB([
        scenarioOf("a1", "user-A", { created_at: now - 1000 }),
        scenarioOf("a2", "user-A", { created_at: now }),
        scenarioOf("a3", "user-A", {
          created_at: now - 2000,
          archived_at: now - 500,
        }),
        scenarioOf("b1", "user-B", { created_at: now }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenarios: ScenarioRow[] };
      expect(body.scenarios.map((s) => s.id)).toEqual(["a2", "a1"]);
    });

    it("includes archived scenarios when ?archived=true", async () => {
      const now = Date.now();
      const { db } = createFakeDB([
        scenarioOf("a1", "user-A", { created_at: now - 1000 }),
        scenarioOf("a2", "user-A", { created_at: now }),
        scenarioOf("a3", "user-A", {
          created_at: now - 2000,
          archived_at: now - 500,
        }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios?archived=true",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenarios: ScenarioRow[] };
      expect(body.scenarios.map((s) => s.id)).toEqual(["a2", "a1", "a3"]);
    });

    it("returns an empty array when the user has no scenarios", async () => {
      const { db } = createFakeDB([scenarioOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ scenarios: [] });
    });
  });

  describe("GET /api/scenarios/:id", () => {
    it("returns the scenario when it belongs to the user", async () => {
      const { db } = createFakeDB([scenarioOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(body.scenario.id).toBe("a1");
      expect(body.scenario.user_id).toBe("user-A");
    });

    it("returns 404 when the id does not exist", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/missing",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    });

    it("returns 404 when the scenario belongs to another user (ownership)", async () => {
      const { db } = createFakeDB([scenarioOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/b1",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    });
  });

  describe("PATCH /api/scenarios/:id", () => {
    it("updates the name", async () => {
      const { db, rows } = createFakeDB([
        scenarioOf("a1", "user-A", { name: "Old" }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "New" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(body.scenario.name).toBe("New");
      expect(rows[0]?.name).toBe("New");
    });

    it("archives the scenario when archived=true", async () => {
      const { db, rows } = createFakeDB([scenarioOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ archived: true }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(typeof body.scenario.archived_at).toBe("number");
      expect(rows[0]?.archived_at).toBe(body.scenario.archived_at);
    });

    it("unarchives the scenario when archived=false", async () => {
      const { db, rows } = createFakeDB([
        scenarioOf("a1", "user-A", { archived_at: Date.now() - 1000 }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ archived: false }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(body.scenario.archived_at).toBeNull();
      expect(rows[0]?.archived_at).toBeNull();
    });

    it("rejects an empty patch body", async () => {
      const { db } = createFakeDB([scenarioOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
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

    it("ignores immutable fields (propertyValue is not patchable)", async () => {
      const { db, rows } = createFakeDB([
        scenarioOf("a1", "user-A", { property_value_cents: 50_000_000 }),
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "Renamed", propertyValue: 9_999 }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(rows[0]?.property_value_cents).toBe(50_000_000);
      expect(rows[0]?.name).toBe("Renamed");
    });

    it("returns 404 when scenario belongs to another user", async () => {
      const { db } = createFakeDB([scenarioOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/b1",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "hijack" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/scenarios/:id", () => {
    it("soft-deletes by setting archived_at", async () => {
      const { db, rows } = createFakeDB([scenarioOf("a1", "user-A")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/a1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { scenario: ScenarioRow };
      expect(typeof body.scenario.archived_at).toBe("number");
      expect(rows[0]?.archived_at).toBe(body.scenario.archived_at);
    });

    it("returns 404 for unknown id", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/missing",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when scenario belongs to another user", async () => {
      const { db, rows } = createFakeDB([scenarioOf("b1", "user-B")]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/b1",
        { method: "DELETE", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(404);
      expect(rows[0]?.archived_at).toBeNull();
    });
  });

  describe("draft endpoints", () => {
    const draftPayload = { propertyValue: 500_000, termMonths: 360 };

    it("returns 401 without a session", async () => {
      mockedCreateAuth.mockReturnValue({
        api: { getSession: async () => null },
      } as unknown as ReturnType<typeof createAuth>);

      const { db } = createFakeDB();
      const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
      app.route("/api/scenarios", scenariosRouter);

      const res = await app.request(
        "/api/scenarios/draft",
        { method: "GET" },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });

    it("GET returns { draft: null } when the user has no draft", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/draft",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ draft: null });
    });

    it("PUT creates the draft and persists the payload", async () => {
      const { db, drafts } = createFakeDB();
      const { app, fakeUser } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(draftPayload),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        draft: typeof draftPayload;
        updated_at: number;
      };
      expect(body.draft).toEqual(draftPayload);
      expect(typeof body.updated_at).toBe("number");
      expect(drafts.get(fakeUser.id)?.payload).toBe(
        JSON.stringify(draftPayload),
      );
    });

    it("PUT upserts the same row for the same user (no duplicates)", async () => {
      const { db, drafts } = createFakeDB();
      const { app, fakeUser } = buildApp("user-A");

      await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(draftPayload),
        },
        envWith(db),
      );

      const updated = { propertyValue: 750_000, termMonths: 240 };
      const res = await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(updated),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(drafts.size).toBe(1);
      expect(drafts.get(fakeUser.id)?.payload).toBe(JSON.stringify(updated));
    });

    it("GET returns the payload saved by a prior PUT", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify(draftPayload),
        },
        envWith(db),
      );

      const res = await app.request(
        "/api/scenarios/draft",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ draft: draftPayload });
    });

    it("PUT rejects a non-object payload with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify([1, 2, 3]),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("PUT rejects malformed JSON with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/scenarios/draft",
        {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: "{not json",
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_json" });
    });
  });
});

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
