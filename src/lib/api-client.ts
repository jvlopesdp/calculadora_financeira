/**
 * Thin typed wrapper around `fetch` for the project's Hono API. Routes that
 * require auth rely on the Better Auth session cookie (sent automatically by
 * `credentials: "same-origin"`). Non-2xx responses throw an `ApiError` so
 * callers can `try/catch` without re-reading `res.ok`.
 */
import type { AuthSession, AuthUser } from "./auth-client";

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

export interface TrackerPlanApi {
  id: string;
  user_id: string;
  name: string;
  property_value_cents: number;
  down_payment_cents: number;
  term_months: number;
  annual_rate_bp: number;
  modality: "PRICE" | "SAC";
  start_date: string;
  target_monthly_total_cents: number;
  created_at: number;
  updated_at: number;
}

export interface TrackerEntryApi {
  id: string;
  plan_id: string;
  month_index: number;
  paid_amount_cents: number;
  paid_at: string;
  apply_mode: "reduce_term" | "reduce_installment";
  note: string | null;
  created_at: number;
}

export interface TrackerPlanDetail {
  plan: TrackerPlanApi;
  entries: TrackerEntryApi[];
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

export interface UpdateScenarioInput {
  name?: string;
  archived?: boolean;
}

export type PaymentType = "parcela" | "amortizacao_extra" | "misto";
export type AmortizationStrategy = "prazo" | "parcela";

export interface CreatePaymentInput {
  referenceMonth: string;
  paymentDate: string;
  amountPaid: number;
  paymentType: PaymentType;
  amortizationStrategy: AmortizationStrategy;
  notes?: string;
}

export type UpdatePaymentInput = {
  referenceMonth?: string;
  paymentDate?: string;
  amountPaid?: number;
  paymentType?: PaymentType;
  amortizationStrategy?: AmortizationStrategy;
  notes?: string | null;
};

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

export async function getScenario(id: string): Promise<ScenarioApi> {
  const body = await jsonFetch<{ scenario: ScenarioApi }>(
    `/api/scenarios/${encodeURIComponent(id)}`,
  );
  return body.scenario;
}

export async function updateScenario(
  id: string,
  input: UpdateScenarioInput,
): Promise<ScenarioApi> {
  const body = await jsonFetch<{ scenario: ScenarioApi }>(
    `/api/scenarios/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return body.scenario;
}

export async function deleteScenario(id: string): Promise<ScenarioApi> {
  const body = await jsonFetch<{ scenario: ScenarioApi }>(
    `/api/scenarios/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  return body.scenario;
}

export async function listPayments(scenarioId: string): Promise<PaymentApi[]> {
  const body = await jsonFetch<{ payments: PaymentApi[] }>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/payments`,
  );
  return body.payments;
}

export async function createPayment(
  scenarioId: string,
  input: CreatePaymentInput,
): Promise<PaymentApi> {
  const body = await jsonFetch<{ payment: PaymentApi }>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/payments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return body.payment;
}

export async function updatePayment(
  scenarioId: string,
  paymentId: string,
  input: UpdatePaymentInput,
): Promise<PaymentApi> {
  const body = await jsonFetch<{ payment: PaymentApi }>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return body.payment;
}

export async function deletePayment(
  scenarioId: string,
  paymentId: string,
): Promise<PaymentApi> {
  const body = await jsonFetch<{ payment: PaymentApi }>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "DELETE",
    },
  );
  return body.payment;
}

export interface CreateTrackerPlanInput {
  name: string;
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  modality: "PRICE" | "SAC";
  startDate: string;
  targetMonthlyTotal: number;
}

export async function listTrackerPlans(): Promise<TrackerPlanApi[]> {
  const body = await jsonFetch<{ plans: TrackerPlanApi[] }>(
    "/api/tracker/plans",
  );
  return body.plans;
}

export async function createTrackerPlan(
  input: CreateTrackerPlanInput,
): Promise<TrackerPlanApi> {
  const body = await jsonFetch<{ plan: TrackerPlanApi }>("/api/tracker/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.plan;
}

export async function getTrackerPlan(id: string): Promise<TrackerPlanDetail> {
  return jsonFetch<TrackerPlanDetail>(
    `/api/tracker/plans/${encodeURIComponent(id)}`,
  );
}

export interface UpsertTrackerEntryInput {
  month_index: number;
  paid_amount: number;
  paid_at: string;
  apply_mode: "reduce_term" | "reduce_installment";
  note?: string | null;
}

/** Creates or updates the entry for `month_index` (server upserts by month). */
export async function upsertTrackerEntry(
  planId: string,
  input: UpsertTrackerEntryInput,
): Promise<TrackerEntryApi> {
  const body = await jsonFetch<{ entry: TrackerEntryApi }>(
    `/api/tracker/plans/${encodeURIComponent(planId)}/entries`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return body.entry;
}

export async function deleteTrackerEntry(
  planId: string,
  entryId: string,
): Promise<TrackerEntryApi> {
  const body = await jsonFetch<{ entry: TrackerEntryApi }>(
    `/api/tracker/plans/${encodeURIComponent(planId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: "DELETE",
    },
  );
  return body.entry;
}

export async function deleteTrackerPlan(id: string): Promise<TrackerPlanApi> {
  const body = await jsonFetch<{ plan: TrackerPlanApi }>(
    `/api/tracker/plans/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  return body.plan;
}

export interface SessionResponse {
  user: AuthUser;
  session: AuthSession;
}

/** Better Auth returns `null` (200) when there is no active session cookie. */
export async function getSession(): Promise<SessionResponse | null> {
  return jsonFetch<SessionResponse | null>("/api/auth/get-session");
}

export async function signOutRequest(): Promise<void> {
  await jsonFetch<unknown>("/api/auth/sign-out", { method: "POST" });
}

export interface DraftResponse {
  /** Opaque to the API; the simulator owns the shape. `null` when no draft. */
  draft: unknown;
}

/** Reads the authenticated user's single saved simulator draft. */
export async function getDraft(): Promise<DraftResponse> {
  return jsonFetch<DraftResponse>("/api/scenarios/draft");
}

/** Upserts the authenticated user's simulator draft (opaque JSON object). */
export async function putDraft(
  payload: object,
): Promise<{ draft: unknown; updated_at: number }> {
  return jsonFetch<{ draft: unknown; updated_at: number }>(
    "/api/scenarios/draft",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}
