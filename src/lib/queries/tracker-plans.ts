import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createTrackerPlan,
  deleteTrackerPlan,
  getTrackerPlan,
  listTrackerPlans,
  type CreateTrackerPlanInput,
  type TrackerPlanApi,
  type TrackerPlanDetail,
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

export function useTrackerPlan(
  id: string | undefined,
): UseQueryResult<TrackerPlanDetail, Error> {
  return useQuery({
    queryKey: trackerPlanQueryKey(id ?? ""),
    queryFn: () => {
      if (!id) {
        throw new Error("tracker plan id is required");
      }
      return getTrackerPlan(id);
    },
    enabled: Boolean(id),
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

export function useDeleteTrackerPlan(): UseMutationResult<
  TrackerPlanApi,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrackerPlan(id),
    onSuccess: (deleted) => {
      void qc.invalidateQueries({ queryKey: TRACKER_PLANS_QUERY_KEY });
      qc.removeQueries({ queryKey: trackerPlanQueryKey(deleted.id) });
    },
  });
}
