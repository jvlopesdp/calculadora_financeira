/**
 * Better Auth CLI config — used only by `bunx @better-auth/cli generate` to
 * produce SQL migrations. NOT loaded by the Worker. The Worker uses
 * `src/server/auth.ts` with the D1 binding.
 *
 * We point the CLI at an in-memory SQLite (bun:sqlite) because the CLI needs a
 * Kysely-compatible database to introspect; the resulting schema matches D1.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- bun:sqlite is a Bun-only runtime module
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

import { sharedAuthOptions } from "./src/server/auth-options";

export const auth = betterAuth({
  ...sharedAuthOptions,
  database: new Database(":memory:"),
  secret: "cli-generation-only-not-a-real-secret",
  baseURL: "http://localhost:5173",
});
