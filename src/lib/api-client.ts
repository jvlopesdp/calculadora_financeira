/**
 * Thin typed wrapper around `fetch` for the project's Hono API. Routes that
 * require auth rely on the Better Auth session cookie (sent automatically by
 * `credentials: "same-origin"`). Non-2xx responses throw an `ApiError` so
 * callers can `try/catch` without re-reading `res.ok`.
 */
export interface ScenarioApi {
  id: string;
  user_id: string;
  name: string | null;
  property_value_cents: number;
  down_payment_cents: number;
  term_months: number;
  annual_rate_basis_points: number;
  start_date: string;
  created_at: number;
  archived_at: number | null;
}

export interface PaymentApi {
  id: string;
  scenario_id: string;
  reference_month: string;
  payment_date: string;
  amount_paid_cents: number;
  payment_type: string;
  amortization_strategy: string;
  notes: string | null;
  created_at: number;
}

export interface CreateScenarioInput {
  name: string;
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  startDate: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(
      `Request failed: ${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }

  return body as T;
}

export async function listScenarios(): Promise<ScenarioApi[]> {
  const body = await jsonFetch<{ scenarios: ScenarioApi[] }>("/api/scenarios");
  return body.scenarios;
}

export async function createScenario(
  input: CreateScenarioInput,
): Promise<ScenarioApi> {
  const body = await jsonFetch<{ scenario: ScenarioApi }>("/api/scenarios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.scenario;
}

export async function listPayments(scenarioId: string): Promise<PaymentApi[]> {
  const body = await jsonFetch<{ payments: PaymentApi[] }>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/payments`,
  );
  return body.payments;
}
