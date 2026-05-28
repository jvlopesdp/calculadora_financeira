import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  TRACKER_PLANS_QUERY_KEY,
  trackerPlanQueryKey,
  useDeleteTrackerEntry,
  useTrackerPlans,
  useUpsertTrackerEntry,
} from "@/lib/queries/tracker-plans";
import {
  ApiError,
  type TrackerEntryApi,
  type TrackerPlanApi,
  type TrackerPlanDetail,
} from "@/lib/api-client";

const listTrackerPlansMock = vi.fn();
const upsertTrackerEntryMock = vi.fn();
const deleteTrackerEntryMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    listTrackerPlans: (...args: unknown[]) => listTrackerPlansMock(...args),
    upsertTrackerEntry: (...args: unknown[]) => upsertTrackerEntryMock(...args),
    deleteTrackerEntry: (...args: unknown[]) => deleteTrackerEntryMock(...args),
  };
});

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Apartamento",
    property_value_cents: 500_000_00,
    down_payment_cents: 100_000_00,
    term_months: 360,
    annual_rate_bp: 1050,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 3_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function makeEntry(
  monthIndex: number,
  overrides: Partial<TrackerEntryApi> = {},
): TrackerEntryApi {
  return {
    id: `entry_${monthIndex}`,
    plan_id: "tp_1",
    month_index: monthIndex,
    paid_amount_cents: 5_000_00,
    paid_at: "2025-01-15",
    apply_mode: "reduce_term",
    note: null,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

function wrapperWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

describe("tracker-plans query hooks", () => {
  beforeEach(() => {
    (listTrackerPlansMock as Mock).mockReset();
    (upsertTrackerEntryMock as Mock).mockReset();
    (deleteTrackerEntryMock as Mock).mockReset();
  });

  it("uses the ['tracker-plans'] query key", () => {
    expect(TRACKER_PLANS_QUERY_KEY).toEqual(["tracker-plans"]);
  });

  it("useTrackerPlans calls listTrackerPlans and exposes data", async () => {
    const plans = [makePlan({ id: "a" }), makePlan({ id: "b" })];
    (listTrackerPlansMock as Mock).mockResolvedValueOnce(plans);

    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useTrackerPlans(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(plans);
    expect(listTrackerPlansMock).toHaveBeenCalledTimes(1);
  });
});

describe("useUpsertTrackerEntry", () => {
  beforeEach(() => {
    (upsertTrackerEntryMock as Mock).mockReset();
  });

  it("optimistically inserts the entry into the plan detail cache", async () => {
    const key = trackerPlanQueryKey("tp_1");
    const seeded: TrackerPlanDetail = {
      plan: makePlan({ id: "tp_1" }),
      entries: [],
    };
    const { qc, Wrapper } = wrapperWithClient();
    qc.setQueryData(key, seeded);

    // Never resolves while we inspect the optimistic state.
    let resolve: ((entry: TrackerEntryApi) => void) | undefined;
    (upsertTrackerEntryMock as Mock).mockImplementation(
      () =>
        new Promise<TrackerEntryApi>((r) => {
          resolve = r;
        }),
    );

    const { result } = renderHook(() => useUpsertTrackerEntry("tp_1"), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      month_index: 3,
      paid_amount: 1234.56,
      paid_at: "2025-03-01",
      apply_mode: "reduce_installment",
    });

    await waitFor(() => {
      const cached = qc.getQueryData<TrackerPlanDetail>(key);
      expect(cached?.entries).toHaveLength(1);
    });
    const optimistic = qc.getQueryData<TrackerPlanDetail>(key)!.entries[0];
    expect(optimistic.month_index).toBe(3);
    expect(optimistic.paid_amount_cents).toBe(123456);
    expect(optimistic.apply_mode).toBe("reduce_installment");

    // Resolve with the canonical server row and confirm reconciliation.
    resolve?.(makeEntry(3, { id: "real_3", paid_amount_cents: 123456 }));
    await waitFor(() => {
      expect(
        qc.getQueryData<TrackerPlanDetail>(key)?.entries[0].id,
      ).toBe("real_3");
    });
  });

  it("rolls back the cache when the mutation fails", async () => {
    const key = trackerPlanQueryKey("tp_1");
    const seeded: TrackerPlanDetail = {
      plan: makePlan({ id: "tp_1" }),
      entries: [makeEntry(1)],
    };
    const { qc, Wrapper } = wrapperWithClient();
    qc.setQueryData(key, seeded);

    (upsertTrackerEntryMock as Mock).mockRejectedValue(
      new ApiError("nope", 422, { error: "validation" }),
    );

    const { result } = renderHook(() => useUpsertTrackerEntry("tp_1"), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      month_index: 2,
      paid_amount: 9999,
      paid_at: "2025-02-01",
      apply_mode: "reduce_term",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // After rollback the cache holds only the original entry.
    const cached = qc.getQueryData<TrackerPlanDetail>(key);
    expect(cached?.entries).toHaveLength(1);
    expect(cached?.entries[0].month_index).toBe(1);
  });
});

describe("useDeleteTrackerEntry", () => {
  beforeEach(() => {
    (deleteTrackerEntryMock as Mock).mockReset();
  });

  it("optimistically removes the entry and rolls back on error", async () => {
    const key = trackerPlanQueryKey("tp_1");
    const seeded: TrackerPlanDetail = {
      plan: makePlan({ id: "tp_1" }),
      entries: [makeEntry(1), makeEntry(2)],
    };
    const { qc, Wrapper } = wrapperWithClient();
    qc.setQueryData(key, seeded);

    (deleteTrackerEntryMock as Mock).mockRejectedValue(
      new ApiError("nope", 404, { error: "not_found" }),
    );

    const { result } = renderHook(() => useDeleteTrackerEntry("tp_1"), {
      wrapper: Wrapper,
    });

    result.current.mutate("entry_1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Rolled back to both entries.
    expect(qc.getQueryData<TrackerPlanDetail>(key)?.entries).toHaveLength(2);
  });
});
