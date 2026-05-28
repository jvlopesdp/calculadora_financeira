import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createPayment,
  deletePayment,
  listPayments,
  updatePayment,
  type CreatePaymentInput,
  type PaymentApi,
  type UpdatePaymentInput,
} from "@/lib/api-client";

export function paymentsQueryKey(
  scenarioId: string,
): readonly [string, string, string] {
  return ["scenarios", scenarioId, "payments"] as const;
}

export function usePayments(
  scenarioId: string | undefined,
): UseQueryResult<PaymentApi[], Error> {
  return useQuery({
    queryKey: paymentsQueryKey(scenarioId ?? ""),
    queryFn: () => {
      if (!scenarioId) {
        throw new Error("scenarioId is required");
      }
      return listPayments(scenarioId);
    },
    enabled: Boolean(scenarioId),
  });
}

export interface CreatePaymentVariables {
  scenarioId: string;
  input: CreatePaymentInput;
}

export function useCreatePayment(): UseMutationResult<
  PaymentApi,
  Error,
  CreatePaymentVariables
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scenarioId, input }: CreatePaymentVariables) =>
      createPayment(scenarioId, input),
    onSuccess: (_payment, { scenarioId }) => {
      void qc.invalidateQueries({ queryKey: paymentsQueryKey(scenarioId) });
    },
  });
}

export interface UpdatePaymentVariables {
  scenarioId: string;
  paymentId: string;
  input: UpdatePaymentInput;
}

export function useUpdatePayment(): UseMutationResult<
  PaymentApi,
  Error,
  UpdatePaymentVariables
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scenarioId, paymentId, input }: UpdatePaymentVariables) =>
      updatePayment(scenarioId, paymentId, input),
    onSuccess: (_payment, { scenarioId }) => {
      void qc.invalidateQueries({ queryKey: paymentsQueryKey(scenarioId) });
    },
  });
}

export interface DeletePaymentVariables {
  scenarioId: string;
  paymentId: string;
}

export function useDeletePayment(): UseMutationResult<
  PaymentApi,
  Error,
  DeletePaymentVariables
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scenarioId, paymentId }: DeletePaymentVariables) =>
      deletePayment(scenarioId, paymentId),
    onSuccess: (_payment, { scenarioId }) => {
      void qc.invalidateQueries({ queryKey: paymentsQueryKey(scenarioId) });
    },
  });
}
