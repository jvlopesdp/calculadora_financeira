import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  paymentsQueryKey,
  useCreatePayment,
  useDeletePayment,
  usePayments,
  useUpdatePayment,
} from "@/lib/queries/payments";
import type { PaymentApi } from "@/lib/api-client";

const listPaymentsMock = vi.fn();
const createPaymentMock = vi.fn();
const updatePaymentMock = vi.fn();
const deletePaymentMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    listPayments: (...args: unknown[]) => listPaymentsMock(...args),
    createPayment: (...args: unknown[]) => createPaymentMock(...args),
    updatePayment: (...args: unknown[]) => updatePaymentMock(...args),
    deletePayment: (...args: unknown[]) => deletePaymentMock(...args),
  };
});

function makePayment(overrides: Partial<PaymentApi> = {}): PaymentApi {
  return {
    id: "p_1",
    scenario_id: "sc_1",
    reference_month: "2025-02",
    payment_date: "2025-02-15",
    amount_paid_cents: 1_000_00,
    payment_type: "parcela",
    amortization_strategy: "prazo",
    notes: null,
    created_at: 1700000000000,
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

describe("payments query hooks", () => {
  beforeEach(() => {
    (listPaymentsMock as Mock).mockReset();
    (createPaymentMock as Mock).mockReset();
    (updatePaymentMock as Mock).mockReset();
    (deletePaymentMock as Mock).mockReset();
  });

  it("usePayments fetches by scenarioId and is disabled without id", async () => {
    const items = [makePayment({ id: "p1" }), makePayment({ id: "p2" })];
    (listPaymentsMock as Mock).mockResolvedValueOnce(items);
    const { Wrapper } = wrapperWithClient();

    const { result: disabled } = renderHook(() => usePayments(undefined), {
      wrapper: Wrapper,
    });
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(listPaymentsMock).not.toHaveBeenCalled();

    const { result } = renderHook(() => usePayments("sc_1"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(listPaymentsMock).toHaveBeenCalledWith("sc_1");
  });

  it("useCreatePayment invalidates the payments list for that scenario", async () => {
    const created = makePayment({ id: "p_new" });
    (createPaymentMock as Mock).mockResolvedValueOnce(created);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCreatePayment(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        scenarioId: "sc_1",
        input: {
          referenceMonth: "2025-02",
          paymentDate: "2025-02-15",
          amountPaid: 1000,
          paymentType: "parcela",
          amortizationStrategy: "prazo",
        },
      });
    });

    expect(createPaymentMock).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentsQueryKey("sc_1"),
    });
  });

  it("useUpdatePayment invalidates the payments list for that scenario", async () => {
    const updated = makePayment({ id: "p_42" });
    (updatePaymentMock as Mock).mockResolvedValueOnce(updated);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePayment(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        scenarioId: "sc_1",
        paymentId: "p_42",
        input: { amountPaid: 1500 },
      });
    });

    expect(updatePaymentMock).toHaveBeenCalledWith("sc_1", "p_42", {
      amountPaid: 1500,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentsQueryKey("sc_1"),
    });
  });

  it("useDeletePayment invalidates the payments list for that scenario", async () => {
    const deleted = makePayment({ id: "p_42" });
    (deletePaymentMock as Mock).mockResolvedValueOnce(deleted);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeletePayment(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        scenarioId: "sc_1",
        paymentId: "p_42",
      });
    });

    expect(deletePaymentMock).toHaveBeenCalledWith("sc_1", "p_42");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentsQueryKey("sc_1"),
    });
  });
});
