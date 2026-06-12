/**
 * Account management router (US-015). Exposes a small REST surface for the
 * authenticated user to read and manage their own account, sitting on top of
 * Better Auth:
 *
 *  - GET    /api/account          → reads name/email/createdAt from the session
 *  - PATCH  /api/account          → updates name (direct SQL) and/or starts an
 *                                   email change (delegates to Better Auth's
 *                                   `auth.api.changeEmail` so the new address
 *                                   is only applied after the verification
 *                                   email is confirmed).
 *  - DELETE /api/account          → hard-deletes the user via Better Auth's
 *                                   `auth.api.deleteUser`, which requires the
 *                                   current password for reauthentication and
 *                                   cascades to sessions, accounts, drafts and
 *                                   tracker_plans/tracker_entries.
 *
 * Password change is intentionally NOT wrapped here — clients call Better
 * Auth's existing `POST /api/auth/change-password` endpoint directly.
 */
import { APIError } from "better-auth/api";
import { Hono } from "hono";
import { z } from "zod";

import { createAuth } from "../auth";
import type { Env } from "../env";
import { requireUser, type AuthVariables } from "../middleware/require-user";

const patchAccountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined, {
    message: "at_least_one_field_required",
  });

const deleteAccountSchema = z.object({
  password: z.string().min(1, "password_required"),
});

const accountRouter = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

accountRouter.use("*", requireUser);

function toIsoOrNull(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Translate a Better Auth `APIError` into our JSON error shape. */
function apiErrorJson(err: APIError): {
  status: number;
  body: { error: string; message?: string };
} {
  const status = err.statusCode ?? 400;
  const body = (err.body ?? {}) as { code?: string; message?: string };
  return {
    status,
    body: {
      error: body.code ?? "bad_request",
      ...(body.message ? { message: body.message } : {}),
    },
  };
}

accountRouter.get("/", (c) => {
  const user = c.get("user");
  return c.json({
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified === true,
      createdAt: toIsoOrNull(user.createdAt),
    },
  });
});

accountRouter.patch("/", async (c) => {
  const user = c.get("user");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = patchAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const { name, email } = parsed.data;
  let emailVerificationSent = false;

  if (name !== undefined && name !== user.name) {
    const now = new Date();
    await c.env.DB.prepare(
      `update "user" set "name" = ?, "updatedAt" = ? where "id" = ?`,
    )
      .bind(name, now, user.id)
      .run();
    user.name = name;
  }

  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    if (normalized !== user.email.toLowerCase()) {
      const auth = createAuth(c.env);
      try {
        await auth.api.changeEmail({
          body: { newEmail: normalized },
          headers: c.req.raw.headers,
        });
        emailVerificationSent = true;
      } catch (err) {
        if (err instanceof APIError) {
          const translated = apiErrorJson(err);
          return c.json(translated.body, translated.status as 400);
        }
        throw err;
      }
    }
  }

  return c.json({
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified === true,
      createdAt: toIsoOrNull(user.createdAt),
    },
    emailVerificationSent,
  });
});

accountRouter.delete("/", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" } as const, 400);
  }

  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation", issues: parsed.error.issues } as const,
      422,
    );
  }

  const auth = createAuth(c.env);
  try {
    await auth.api.deleteUser({
      body: { password: parsed.data.password },
      headers: c.req.raw.headers,
    });
  } catch (err) {
    if (err instanceof APIError) {
      const translated = apiErrorJson(err);
      return c.json(translated.body, translated.status as 400);
    }
    throw err;
  }

  return c.json({ success: true } as const);
});

export default accountRouter;
