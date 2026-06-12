import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_QUERY_KEY,
  useAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "@/lib/queries/account";
import { SESSION_QUERY_KEY } from "@/lib/query-client";
import type { AccountApi, UpdateAccountResponse } from "@/lib/api-client";

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    getAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
});

import * as apiClient from "@/lib/api-client";

function makeAccount(overrides: Partial<AccountApi> = {}): AccountApi {
  return {
    id: "u_1",
    name: "Maria",
    email: "m@example.com",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useAccount", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getAccount).mockReset();
    vi.mocked(apiClient.updateAccount).mockReset();
  });

  it("fetches the account through getAccount", async () => {
    vi.mocked(apiClient.getAccount).mockResolvedValue(makeAccount());
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(makeAccount());
  });
});

describe("useUpdateAccount", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getAccount).mockReset();
    vi.mocked(apiClient.updateAccount).mockReset();
  });

  it("calls updateAccount and seeds the account cache + invalidates the session", async () => {
    const updated: UpdateAccountResponse = {
      account: makeAccount({ name: "Maria Nova" }),
      emailVerificationSent: false,
    };
    vi.mocked(apiClient.updateAccount).mockResolvedValue(updated);
    const { queryClient, wrapper } = makeWrapper();

    const sessionData = { user: { id: "u_1" }, session: { id: "s_1" } };
    queryClient.setQueryData(SESSION_QUERY_KEY, sessionData);
    const sessionState = queryClient.getQueryState(SESSION_QUERY_KEY);
    const initialUpdatedAt = sessionState?.dataUpdatedAt ?? 0;

    const { result } = renderHook(() => useUpdateAccount(), { wrapper });
    const promise = result.current.mutateAsync({ name: "Maria Nova" });
    await promise;

    expect(vi.mocked(apiClient.updateAccount)).toHaveBeenCalledWith({
      name: "Maria Nova",
    });
    expect(queryClient.getQueryData(["account"])).toEqual(updated.account);

    // Session got invalidated (a refetch was scheduled).
    await waitFor(() => {
      const next = queryClient.getQueryState(SESSION_QUERY_KEY);
      expect(next?.isInvalidated || (next?.dataUpdatedAt ?? 0) >= initialUpdatedAt).toBe(true);
    });
  });
});

describe("useDeleteAccount", () => {
  beforeEach(() => {
    vi.mocked(apiClient.deleteAccount).mockReset();
  });

  it("calls deleteAccount, clears the account cache and invalidates the session", async () => {
    vi.mocked(apiClient.deleteAccount).mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();

    queryClient.setQueryData(ACCOUNT_QUERY_KEY, makeAccount());
    queryClient.setQueryData(SESSION_QUERY_KEY, {
      user: { id: "u_1" },
      session: { id: "s_1" },
    });
    const initialSession = queryClient.getQueryState(SESSION_QUERY_KEY);
    const initialUpdatedAt = initialSession?.dataUpdatedAt ?? 0;

    const { result } = renderHook(() => useDeleteAccount(), { wrapper });
    await result.current.mutateAsync({ password: "correct-horse" });

    expect(vi.mocked(apiClient.deleteAccount)).toHaveBeenCalledWith({
      password: "correct-horse",
    });
    expect(queryClient.getQueryData(ACCOUNT_QUERY_KEY)).toBeNull();

    await waitFor(() => {
      const next = queryClient.getQueryState(SESSION_QUERY_KEY);
      expect(
        next?.isInvalidated || (next?.dataUpdatedAt ?? 0) >= initialUpdatedAt,
      ).toBe(true);
    });
  });
});
