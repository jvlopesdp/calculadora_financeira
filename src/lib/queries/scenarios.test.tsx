import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  SCENARIOS_QUERY_KEY,
  scenarioQueryKey,
  useCreateScenario,
  useDeleteScenario,
  useScenario,
  useScenarios,
  useUpdateScenario,
} from "@/lib/queries/scenarios";
import type { ScenarioApi } from "@/lib/api-client";

const listScenariosMock = vi.fn();
const getScenarioMock = vi.fn();
const createScenarioMock = vi.fn();
const updateScenarioMock = vi.fn();
const deleteScenarioMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    listScenarios: (...args: unknown[]) => listScenariosMock(...args),
    getScenario: (...args: unknown[]) => getScenarioMock(...args),
    createScenario: (...args: unknown[]) => createScenarioMock(...args),
    updateScenario: (...args: unknown[]) => updateScenarioMock(...args),
    deleteScenario: (...args: unknown[]) => deleteScenarioMock(...args),
  };
});

function makeScenario(overrides: Partial<ScenarioApi> = {}): ScenarioApi {
  return {
    id: "sc_1",
    user_id: "u_1",
    name: "Casa A",
    property_value_cents: 500_000_00,
    down_payment_cents: 100_000_00,
    term_months: 360,
    annual_rate_basis_points: 1050,
    start_date: "2025-01-01",
    created_at: 1700000000000,
    archived_at: null,
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

describe("scenarios query hooks", () => {
  beforeEach(() => {
    (listScenariosMock as Mock).mockReset();
    (getScenarioMock as Mock).mockReset();
    (createScenarioMock as Mock).mockReset();
    (updateScenarioMock as Mock).mockReset();
    (deleteScenarioMock as Mock).mockReset();
  });

  it("useScenarios calls listScenarios and exposes data", async () => {
    const items = [makeScenario({ id: "a" }), makeScenario({ id: "b" })];
    (listScenariosMock as Mock).mockResolvedValueOnce(items);

    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useScenarios(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(listScenariosMock).toHaveBeenCalledTimes(1);
  });

  it("useScenarios honors enabled: false", () => {
    (listScenariosMock as Mock).mockResolvedValueOnce([]);
    const { Wrapper } = wrapperWithClient();
    renderHook(() => useScenarios({ enabled: false }), { wrapper: Wrapper });
    expect(listScenariosMock).not.toHaveBeenCalled();
  });

  it("useScenario fetches by id and stays disabled without id", async () => {
    const sc = makeScenario({ id: "sc_42" });
    (getScenarioMock as Mock).mockResolvedValueOnce(sc);
    const { Wrapper } = wrapperWithClient();

    const { result: disabled } = renderHook(() => useScenario(undefined), {
      wrapper: Wrapper,
    });
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(getScenarioMock).not.toHaveBeenCalled();

    const { result } = renderHook(() => useScenario("sc_42"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sc);
    expect(getScenarioMock).toHaveBeenCalledWith("sc_42");
  });

  it("useCreateScenario invalidates ['scenarios'] and seeds the detail key", async () => {
    const created = makeScenario({ id: "sc_99", name: "Novo" });
    (createScenarioMock as Mock).mockResolvedValueOnce(created);

    const { qc, Wrapper } = wrapperWithClient();
    qc.setQueryData<ScenarioApi[]>(SCENARIOS_QUERY_KEY, []);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCreateScenario(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "Novo",
        propertyValue: 100,
        downPayment: 10,
        termMonths: 12,
        annualRate: 5,
        startDate: "2025-01-01",
      });
    });

    expect(createScenarioMock).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: SCENARIOS_QUERY_KEY,
    });
    expect(qc.getQueryData(scenarioQueryKey("sc_99"))).toEqual(created);
  });

  it("useUpdateScenario invalidates list and updates detail cache", async () => {
    const updated = makeScenario({ id: "sc_99", name: "Editado" });
    (updateScenarioMock as Mock).mockResolvedValueOnce(updated);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateScenario(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        id: "sc_99",
        input: { name: "Editado" },
      });
    });

    expect(updateScenarioMock).toHaveBeenCalledWith("sc_99", {
      name: "Editado",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: SCENARIOS_QUERY_KEY,
    });
    expect(qc.getQueryData(scenarioQueryKey("sc_99"))).toEqual(updated);
  });

  it("useDeleteScenario invalidates list", async () => {
    const deleted = makeScenario({
      id: "sc_99",
      archived_at: 1700000001000,
    });
    (deleteScenarioMock as Mock).mockResolvedValueOnce(deleted);

    const { qc, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteScenario(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync("sc_99");
    });

    expect(deleteScenarioMock).toHaveBeenCalledWith("sc_99");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: SCENARIOS_QUERY_KEY,
    });
  });
});
