import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createTrackerPlan,
  listTrackerPlans,
  type CreateTrackerPlanInput,
  type TrackerPlanApi,
} from "@/lib/api-client";

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

export function useCreateTrackerPlan(): UseMutationResult<
  TrackerPlanApi,
  Error,
  CreateTrackerPlanInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTrackerPlanInput) => createTrackerPlan(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TRACKER_PLANS_QUERY_KEY });
    },
  });
}
