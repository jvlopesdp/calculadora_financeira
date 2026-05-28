import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  TRACKER_PLANS_QUERY_KEY,
  useTrackerPlans,
} from "@/lib/queries/tracker-plans";
import type { TrackerPlanApi } from "@/lib/api-client";

const listTrackerPlansMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    listTrackerPlans: (...args: unknown[]) => listTrackerPlansMock(...args),
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
