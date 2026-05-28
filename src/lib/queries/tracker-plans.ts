import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createTrackerPlan,
  deleteTrackerEntry,
  deleteTrackerPlan,
  getTrackerPlan,
  listTrackerPlans,
  upsertTrackerEntry,
  type CreateTrackerPlanInput,
  type TrackerEntryApi,
  type TrackerPlanApi,
  type TrackerPlanDetail,
  type UpsertTrackerEntryInput,
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

interface EntryMutationContext {
  previous: TrackerPlanDetail | undefined;
}

function sortEntriesByMonth(entries: TrackerEntryApi[]): TrackerEntryApi[] {
  return [...entries].sort((a, b) => a.month_index - b.month_index);
}

/**
 * Upserts a month's entry with an optimistic update of the plan detail cache
 * (`['tracker-plan', planId]`) so the spreadsheet/curves reflect the change
 * instantly. `onError` restores the pre-mutation snapshot; `onSuccess`
 * reconciles the optimistic row with the canonical server row (real id/created_at).
 */
export function useUpsertTrackerEntry(
  planId: string,
): UseMutationResult<
  TrackerEntryApi,
  Error,
  UpsertTrackerEntryInput,
  EntryMutationContext
> {
  const qc = useQueryClient();
  const key = trackerPlanQueryKey(planId);
  return useMutation({
    mutationFn: (input: UpsertTrackerEntryInput) =>
      upsertTrackerEntry(planId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TrackerPlanDetail>(key);
      if (previous) {
        const existing = previous.entries.find(
          (e) => e.month_index === input.month_index,
        );
        const optimistic: TrackerEntryApi = {
          id: existing?.id ?? `optimistic-${input.month_index}`,
          plan_id: planId,
          month_index: input.month_index,
          paid_amount_cents: Math.round(input.paid_amount * 100),
          paid_at: input.paid_at,
          apply_mode: input.apply_mode,
          note: input.note ?? null,
          created_at: existing?.created_at ?? Date.now(),
        };
        qc.setQueryData<TrackerPlanDetail>(key, {
          ...previous,
          entries: sortEntriesByMonth([
            ...previous.entries.filter(
              (e) => e.month_index !== input.month_index,
            ),
            optimistic,
          ]),
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSuccess: (entry) => {
      const current = qc.getQueryData<TrackerPlanDetail>(key);
      if (current) {
        qc.setQueryData<TrackerPlanDetail>(key, {
          ...current,
          entries: sortEntriesByMonth([
            ...current.entries.filter(
              (e) => e.month_index !== entry.month_index,
            ),
            entry,
          ]),
        });
      }
    },
  });
}

/**
 * Deletes an entry with an optimistic removal from the plan detail cache;
 * `onError` restores the snapshot.
 */
export function useDeleteTrackerEntry(
  planId: string,
): UseMutationResult<TrackerEntryApi, Error, string, EntryMutationContext> {
  const qc = useQueryClient();
  const key = trackerPlanQueryKey(planId);
  return useMutation({
    mutationFn: (entryId: string) => deleteTrackerEntry(planId, entryId),
    onMutate: async (entryId) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TrackerPlanDetail>(key);
      if (previous) {
        qc.setQueryData<TrackerPlanDetail>(key, {
          ...previous,
          entries: previous.entries.filter((e) => e.id !== entryId),
        });
      }
      return { previous };
    },
    onError: (_err, _entryId, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
  });
}
