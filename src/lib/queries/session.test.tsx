import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useSession, useSignOut } from "@/lib/queries/session";
import { SESSION_QUERY_KEY } from "@/lib/query-client";
import type { SessionResponse } from "@/lib/api-client";

const getSessionMock = vi.fn();
const signOutRequestMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    getSession: (...args: unknown[]) => getSessionMock(...args),
    signOutRequest: (...args: unknown[]) => signOutRequestMock(...args),
  };
});

function makeSession(): SessionResponse {
  return {
    user: {
      id: "u_1",
      email: "user@example.com",
      name: "Joana",
      emailVerified: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      image: null,
    },
    session: {
      id: "s_1",
      userId: "u_1",
      token: "t",
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    },
  } as SessionResponse;
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

describe("session query hooks", () => {
  beforeEach(() => {
    (getSessionMock as Mock).mockReset();
    (signOutRequestMock as Mock).mockReset();
  });

  it("useSession derives user and session from the response", async () => {
    const data = makeSession();
    (getSessionMock as Mock).mockResolvedValueOnce(data);

    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.user).toEqual(data.user);
    expect(result.current.session).toEqual(data.session);
    expect(result.current.isError).toBe(false);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("useSession resolves a null response to anonymous", async () => {
    (getSessionMock as Mock).mockResolvedValueOnce(null);

    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("useSession surfaces isError when the fetch rejects", async () => {
    (getSessionMock as Mock).mockRejectedValueOnce(new Error("network"));

    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.user).toBeNull();
  });

  it("useSignOut posts sign-out and invalidates ['session']", async () => {
    (signOutRequestMock as Mock).mockResolvedValueOnce(undefined);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSignOut(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(signOutRequestMock).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: SESSION_QUERY_KEY,
    });
  });
});
