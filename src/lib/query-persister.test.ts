import { Query } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistMock = vi.fn();

vi.mock("@tanstack/react-query-persist-client", () => ({
  persistQueryClient: (...args: unknown[]) => persistMock(...args),
}));

type DehydrateOptions = {
  shouldDehydrateQuery: (query: Query) => boolean;
};

function makeQuery(queryKey: ReadonlyArray<unknown>, status: string): Query {
  return {
    queryKey,
    state: { status },
  } as unknown as Query;
}

async function freshImport() {
  vi.resetModules();
  const persister = await import("@/lib/query-persister");
  const client = await import("@/lib/query-client");
  return { ...persister, ...client };
}

describe("startQueryPersister", () => {
  beforeEach(() => {
    persistMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("registers persistence with cf-app-query-v1 key and excludes the session query", async () => {
    const { startQueryPersister, queryClient } = await freshImport();
    startQueryPersister();

    expect(persistMock).toHaveBeenCalledTimes(1);
    const [opts] = persistMock.mock.calls[0] as [
      {
        queryClient: typeof queryClient;
        buster: string;
        dehydrateOptions: DehydrateOptions;
      },
    ];
    expect(opts.queryClient).toBe(queryClient);
    expect(typeof opts.buster).toBe("string");

    const { shouldDehydrateQuery } = opts.dehydrateOptions;
    expect(shouldDehydrateQuery(makeQuery(["session"], "success"))).toBe(false);
    expect(shouldDehydrateQuery(makeQuery(["scenarios"], "success"))).toBe(
      true,
    );
    expect(shouldDehydrateQuery(makeQuery(["scenarios"], "pending"))).toBe(
      false,
    );
  });

  it("is idempotent across repeated calls", async () => {
    const { startQueryPersister } = await freshImport();
    startQueryPersister();
    startQueryPersister();
    expect(persistMock).toHaveBeenCalledTimes(1);
  });
});
