import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn();

vi.mock("./auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
  },
}));

import { useCurrentUser } from "./use-current-user";

describe("useCurrentUser", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("returns the user when a session exists", () => {
    const user = {
      id: "user_1",
      email: "joao@example.com",
      name: "João",
      emailVerified: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      image: null,
    };
    useSessionMock.mockReturnValue({
      data: {
        user,
        session: {
          id: "sess_1",
          userId: "user_1",
          expiresAt: new Date("2026-12-31T00:00:00Z"),
        },
      },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toEqual(user);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns user=null when no session is present", () => {
    useSessionMock.mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports isLoading=true while the session is pending", () => {
    useSessionMock.mockReturnValue({
      data: null,
      isPending: true,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("surfaces an error from the session hook", () => {
    const error = new Error("network");
    useSessionMock.mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
      error,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.error).toBe(error);
    expect(result.current.user).toBeNull();
  });
});
