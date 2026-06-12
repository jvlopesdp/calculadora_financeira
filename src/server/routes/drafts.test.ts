import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import draftsRouter from "./drafts";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

interface DraftRow {
  payload: string;
  updated_at: number;
}

interface FakeDB {
  drafts: Map<string, DraftRow>;
  db: D1Database;
}

/**
 * Minimal in-memory D1 stub for the simulator draft endpoint. Recognises only
 * the two SQL shapes the router emits (select / upsert) and throws on anything
 * else — a typo or new query fails loudly.
 */
function createFakeDB(): FakeDB {
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
          if (sql.startsWith('insert into "scenario_drafts"')) {
            const [user_id, payload, updated_at] = args as [
              string,
              string,
              number,
            ];
            drafts.set(user_id, { payload, updated_at });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
        async first<T>(): Promise<T | null> {
          if (sql.startsWith('select "payload" from "scenario_drafts"')) {
            const [user_id] = args as [string];
            const draft = drafts.get(user_id);
            return (draft ? { payload: draft.payload } : null) as T | null;
          }
          throw new Error(`Unhandled SQL (first): ${sql}`);
        },
      };

      return stmt;
    },
  };

  return {
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
  app.route("/api/drafts", draftsRouter);
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

describe("drafts router", () => {
  const draftPayload = { propertyValue: 500_000, termMonths: 360 };

  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  it("returns 401 without a session", async () => {
    mockedCreateAuth.mockReturnValue({
      api: { getSession: async () => null },
    } as unknown as ReturnType<typeof createAuth>);

    const { db } = createFakeDB();
    const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
    app.route("/api/drafts", draftsRouter);

    const res = await app.request(
      "/api/drafts",
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
      "/api/drafts",
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
      "/api/drafts",
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
    expect(drafts.get(fakeUser.id)?.payload).toBe(JSON.stringify(draftPayload));
  });

  it("PUT upserts the same row for the same user (no duplicates)", async () => {
    const { db, drafts } = createFakeDB();
    const { app, fakeUser } = buildApp("user-A");

    await app.request(
      "/api/drafts",
      {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(draftPayload),
      },
      envWith(db),
    );

    const updated = { propertyValue: 750_000, termMonths: 240 };
    const res = await app.request(
      "/api/drafts",
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
      "/api/drafts",
      {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(draftPayload),
      },
      envWith(db),
    );

    const res = await app.request(
      "/api/drafts",
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
      "/api/drafts",
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
      "/api/drafts",
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
