import { describe, expect, it } from "vitest";

import { queryClient, SESSION_QUERY_KEY } from "@/lib/query-client";

describe("queryClient", () => {
  it("applies the configured defaults", () => {
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(5 * 60 * 1000);
    expect(defaults?.gcTime).toBe(24 * 60 * 60 * 1000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it("exposes the session query key sentinel", () => {
    expect(SESSION_QUERY_KEY).toEqual(["session"]);
  });
});
