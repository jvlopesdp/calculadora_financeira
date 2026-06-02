import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createScenario,
  deleteScenario,
  getScenario,
  listScenarios,
  updateScenario,
  type CreateScenarioInput,
  type ScenarioApi,
  type UpdateScenarioInput,
} from "@/lib/api-client";

export const SCENARIOS_QUERY_KEY = ["scenarios"] as const;

export function scenarioQueryKey(id: string): readonly [string, string] {
  return ["scenario", id] as const;
}

export interface UseScenariosOptions {
  enabled?: boolean;
}

export function useScenarios(
  options: UseScenariosOptions = {},
): UseQueryResult<ScenarioApi[], Error> {
  return useQuery({
    queryKey: SCENARIOS_QUERY_KEY,
    queryFn: () => listScenarios(),
    enabled: options.enabled ?? true,
  });
}

export function useScenario(
  id: string | undefined,
): UseQueryResult<ScenarioApi, Error> {
  return useQuery({
    queryKey: scenarioQueryKey(id ?? ""),
    queryFn: () => {
      if (!id) {
        throw new Error("scenario id is required");
      }
      return getScenario(id);
    },
    enabled: Boolean(id),
  });
}

export function useCreateScenario(): UseMutationResult<
  ScenarioApi,
  Error,
  CreateScenarioInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScenarioInput) => createScenario(input),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: SCENARIOS_QUERY_KEY });
      qc.setQueryData(scenarioQueryKey(created.id), created);
    },
  });
}

export interface UpdateScenarioVariables {
  id: string;
  input: UpdateScenarioInput;
}

export function useUpdateScenario(): UseMutationResult<
  ScenarioApi,
  Error,
  UpdateScenarioVariables
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateScenarioVariables) =>
      updateScenario(id, input),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: SCENARIOS_QUERY_KEY });
      qc.setQueryData(scenarioQueryKey(updated.id), updated);
    },
  });
}

export function useDeleteScenario(): UseMutationResult<
  ScenarioApi,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScenario(id),
    onSuccess: (deleted) => {
      void qc.invalidateQueries({ queryKey: SCENARIOS_QUERY_KEY });
      qc.setQueryData(scenarioQueryKey(deleted.id), deleted);
    },
  });
}
