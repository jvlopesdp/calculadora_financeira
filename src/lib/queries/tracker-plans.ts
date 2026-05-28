import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listTrackerPlans, type TrackerPlanApi } from "@/lib/api-client";

export const TRACKER_PLANS_QUERY_KEY = ["tracker-plans"] as const;

export function trackerPlanQueryKey(id: string): readonly [string, string] {
  return ["tracker-plan", id] as const;
}

export function useTrackerPlans(): UseQueryResult<TrackerPlanApi[], Error> {
  return useQuery({
    queryKey: TRACKER_PLANS_QUERY_KEY,
    queryFn: () => listTrackerPlans(),
  });
}
