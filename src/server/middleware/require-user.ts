import { createMiddleware } from "hono/factory";

import { createAuth, type Auth } from "../auth";
import type { Env } from "../env";

type GetSessionResult = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;

export type AuthUser = GetSessionResult["user"];
export type AuthSession = GetSessionResult["session"];

export type AuthVariables = {
  user: AuthUser;
  session: AuthSession;
};

/**
 * Hono middleware that resolves the current Better Auth session from the
 * request cookies/headers and short-circuits with 401 when missing/invalid.
 *
 * On success, the resolved `user` and `session` are exposed via `c.var`.
 */
export const requireUser = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const auth = createAuth(c.env);

  let result: Awaited<ReturnType<Auth["api"]["getSession"]>> = null;
  try {
    result = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch {
    result = null;
  }

  if (!result) {
    return c.json({ error: "unauthorized" } as const, 401);
  }

  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});
