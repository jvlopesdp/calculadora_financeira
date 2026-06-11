import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  getAccount,
  updateAccount,
  type AccountApi,
  type UpdateAccountInput,
  type UpdateAccountResponse,
} from "@/lib/api-client";
import { SESSION_QUERY_KEY } from "@/lib/query-client";

export const ACCOUNT_QUERY_KEY = ["account"] as const;

export function useAccount(): UseQueryResult<AccountApi, Error> {
  return useQuery({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: getAccount,
  });
}

export function useUpdateAccount(): UseMutationResult<
  UpdateAccountResponse,
  Error,
  UpdateAccountInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAccountInput) => updateAccount(input),
    onSuccess: (data) => {
      qc.setQueryData(ACCOUNT_QUERY_KEY, data.account);
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
