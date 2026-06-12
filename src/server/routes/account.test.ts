import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { APIError } from "better-auth/api";

import { createAuth } from "../auth";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/require-user";
import accountRouter from "./account";

vi.mock("../auth", () => ({
  createAuth: vi.fn(),
}));

const mockedCreateAuth = vi.mocked(createAuth);

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal in-memory D1 stub for the account router. Recognises the exact SQL
 * shapes the router emits — currently just the name UPDATE on the "user"
 * table. Throws on any other SQL so a typo fails loudly.
 */
function createFakeDB(initialUsers: UserRow[] = []) {
  const users: UserRow[] = [...initialUsers];

  const db = {
    prepare(sql: string) {
      let args: readonly unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (sql.startsWith('update "user" set "name"')) {
            const [name, updatedAt, id] = args as [string, Date, string];
            const u = users.find((u) => u.id === id);
            if (u) {
              u.name = name;
              u.updatedAt = updatedAt;
            }
            return { success: true, meta: {} };
          }
          throw new Error(`Unhandled SQL (run): ${sql}`);
        },
      };
      return stmt;
    },
  };

  return { users, db: db as unknown as D1Database };
}

interface FakeAuthOverrides {
  changeEmail?: ReturnType<typeof vi.fn>;
  deleteUser?: ReturnType<typeof vi.fn>;
  session?: unknown;
}

function buildApp(userId: string, overrides: FakeAuthOverrides = {}) {
  const fakeUser = {
    id: userId,
    name: `Name-${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const fakeSession = {
    id: `sess-${userId}`,
    token: `tok-${userId}`,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(Date.now() - 1000),
  };

  const session =
    overrides.session === undefined
      ? { user: fakeUser, session: fakeSession }
      : overrides.session;

  mockedCreateAuth.mockReturnValue({
    api: {
      getSession: async () => session,
      changeEmail:
        overrides.changeEmail ?? vi.fn(async () => ({ status: true })),
      deleteUser:
        overrides.deleteUser ??
        vi.fn(async () => ({ success: true, message: "User deleted" })),
    },
  } as unknown as ReturnType<typeof createAuth>);

  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.route("/api/account", accountRouter);
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

describe("account router", () => {
  beforeEach(() => {
    mockedCreateAuth.mockReset();
  });

  describe("auth", () => {
    it("returns 401 when there is no session for GET", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { session: null });

      const res = await app.request(
        "/api/account",
        { method: "GET" },
        envWith(db),
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });

    it("returns 401 when there is no session for PATCH", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { session: null });

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "X" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(401);
    });

    it("returns 401 when there is no session for DELETE", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { session: null });

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: "x" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/account", () => {
    it("returns id, name, email, emailVerified and createdAt from the session", async () => {
      const { db } = createFakeDB();
      const { app, fakeUser } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        { method: "GET", headers: { cookie } },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        account: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
          createdAt: string;
        };
      };
      expect(body.account).toEqual({
        id: fakeUser.id,
        name: fakeUser.name,
        email: fakeUser.email,
        emailVerified: true,
        createdAt: fakeUser.createdAt.toISOString(),
      });
    });
  });

  describe("PATCH /api/account", () => {
    it("updates the name in the user table and returns the new value", async () => {
      const { db, users } = createFakeDB([
        {
          id: "user-A",
          name: "Old Name",
          email: "user-A@example.com",
          emailVerified: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ]);
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "Joana" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { account: { name: string } };
      expect(body.account.name).toBe("Joana");
      expect(users[0]?.name).toBe("Joana");
    });

    it("rejects invalid JSON with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: "{not json",
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_json" });
    });

    it("rejects an empty body with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
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

    it("rejects a name that is too long with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "x".repeat(101) }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
    });

    it("rejects an invalid email with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "not-an-email" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
    });

    it("delegates email change to Better Auth and flags verification as sent", async () => {
      const changeEmail = vi.fn(
        async (_args: { body: { newEmail: string }; headers: Headers }) => ({
          status: true,
        }),
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { changeEmail });

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "new@example.com" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(changeEmail).toHaveBeenCalledTimes(1);
      const callArgs = changeEmail.mock.calls[0]?.[0];
      expect(callArgs?.body.newEmail).toBe("new@example.com");
      const body = (await res.json()) as {
        account: { email: string };
        emailVerificationSent: boolean;
      };
      // Email is NOT updated yet — only after verification.
      expect(body.account.email).toBe("user-A@example.com");
      expect(body.emailVerificationSent).toBe(true);
    });

    it("skips the email change when the value matches the current email", async () => {
      const changeEmail = vi.fn(
        async (_args: { body: { newEmail: string }; headers: Headers }) => ({
          status: true,
        }),
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { changeEmail });

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "USER-A@EXAMPLE.COM" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(changeEmail).not.toHaveBeenCalled();
      const body = (await res.json()) as { emailVerificationSent: boolean };
      expect(body.emailVerificationSent).toBe(false);
    });

    it("translates Better Auth APIError to JSON when email change fails", async () => {
      const changeEmail = vi.fn(
        async (_args: { body: { newEmail: string }; headers: Headers }) => {
          throw new APIError("BAD_REQUEST", {
            code: "EMAIL_TAKEN",
            message: "Email already in use",
          });
        },
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { changeEmail });

      const res = await app.request(
        "/api/account",
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "taken@example.com" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("EMAIL_TAKEN");
      expect(body.message).toBe("Email already in use");
    });
  });

  describe("DELETE /api/account", () => {
    it("deletes the user via auth.api.deleteUser and returns success", async () => {
      const deleteUser = vi.fn(
        async (_args: { body: { password: string }; headers: Headers }) => ({
          success: true,
          message: "User deleted",
        }),
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { deleteUser });

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ password: "correct-horse" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(deleteUser).toHaveBeenCalledTimes(1);
      const callArgs = deleteUser.mock.calls[0]?.[0];
      expect(callArgs?.body.password).toBe("correct-horse");
    });

    it("rejects invalid JSON with 400", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: "{not json",
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_json" });
    });

    it("rejects a missing password with 422", async () => {
      const { db } = createFakeDB();
      const { app } = buildApp("user-A");

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        envWith(db),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("validation");
    });

    it("returns 400 with INVALID_PASSWORD when the password is wrong", async () => {
      const deleteUser = vi.fn(
        async (_args: { body: { password: string }; headers: Headers }) => {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_PASSWORD",
            message: "Invalid password",
          });
        },
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { deleteUser });

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ password: "wrong" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body.error).toBe("INVALID_PASSWORD");
    });

    it("returns 400 when reauth is invalid (CREDENTIAL_ACCOUNT_NOT_FOUND)", async () => {
      const deleteUser = vi.fn(
        async (_args: { body: { password: string }; headers: Headers }) => {
          throw new APIError("BAD_REQUEST", {
            code: "CREDENTIAL_ACCOUNT_NOT_FOUND",
            message: "Credential account not found",
          });
        },
      );
      const { db } = createFakeDB();
      const { app } = buildApp("user-A", { deleteUser });

      const res = await app.request(
        "/api/account",
        {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ password: "any" }),
        },
        envWith(db),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("CREDENTIAL_ACCOUNT_NOT_FOUND");
    });
  });
});
