import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DRAFT_AUTOSAVE_DEBOUNCE_MS,
  useSimulatorDraft,
} from "@/features/simulator/hooks/use-simulator-draft";
import {
  SIM_DRAFT_KEY,
  type FinancingDraft,
} from "@/features/simulator/lib/simulator-draft";

const sessionState: { user: { id: string } | null } = { user: null };

vi.mock("@/lib/queries/session", () => ({
  useSession: () => ({
    user: sessionState.user,
    session: null,
    isPending: false,
    isError: false,
  }),
}));

const SAMPLE: FinancingDraft = {
  propertyValue: 500_000,
  downPayment: 100_000,
  monthlyRate: 0.8,
  termMonths: 360,
  system: "PRICE",
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useSimulatorDraft", () => {
  beforeEach(() => {
    sessionState.user = null;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("restores the localStorage draft synchronously on first render", () => {
    localStorage.setItem(SIM_DRAFT_KEY, JSON.stringify(SAMPLE));
    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.initialFinancing).toMatchObject(SAMPLE);
  });

  it("debounced save writes localStorage only (no D1 PUT) when logged out", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.reportInput(SAMPLE));
    // Nothing persisted before the debounce window elapses.
    expect(localStorage.getItem(SIM_DRAFT_KEY)).toBeNull();

    act(() => vi.advanceTimersByTime(DRAFT_AUTOSAVE_DEBOUNCE_MS));

    expect(JSON.parse(localStorage.getItem(SIM_DRAFT_KEY) ?? "null")).toMatchObject(
      SAMPLE,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("collapses rapid changes into a single debounced save", () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.reportInput({ ...SAMPLE, propertyValue: 100 });
      result.current.reportInput({ ...SAMPLE, propertyValue: 200 });
      result.current.reportInput(SAMPLE);
    });
    act(() => vi.advanceTimersByTime(DRAFT_AUTOSAVE_DEBOUNCE_MS));

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(localStorage.getItem(SIM_DRAFT_KEY) ?? "null"),
    ).toMatchObject(SAMPLE);
  });

  it("debounced save also PUTs to D1 when logged in", async () => {
    sessionState.user = { id: "user-1" };
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === "PUT") return jsonResponse({ draft: {}, updated_at: 1 });
      return jsonResponse({ draft: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });
    // Flush the on-mount GET /draft query.
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => result.current.reportInput(SAMPLE));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(
      JSON.parse(localStorage.getItem(SIM_DRAFT_KEY) ?? "null"),
    ).toMatchObject(SAMPLE);
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall?.[0]).toBe("/api/drafts");
  });

  it("restores the D1 draft for a logged-in user", async () => {
    sessionState.user = { id: "user-1" };
    const fetchMock = vi.fn(async () => jsonResponse({ draft: SAMPLE }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.restoreToken).toBe(1));
    expect(result.current.restoredFinancing).toMatchObject(SAMPLE);
  });

  it("does not restore the D1 draft once the user has started typing", async () => {
    sessionState.user = { id: "user-1" };
    let resolveGet: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulatorDraft(), {
      wrapper: makeWrapper(),
    });

    // User types before the D1 GET resolves.
    act(() => result.current.reportInput({ ...SAMPLE, propertyValue: 1 }));
    await act(async () => {
      resolveGet?.(jsonResponse({ draft: SAMPLE }));
      await Promise.resolve();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.restoreToken).toBe(0);
    expect(result.current.restoredFinancing).toBeNull();
  });
});
