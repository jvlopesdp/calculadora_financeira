/**
 * Thin typed wrapper around `fetch` for the project's Hono API. Routes that
 * require auth rely on the Better Auth session cookie (sent automatically by
 * `credentials: "same-origin"`). Non-2xx responses throw an `ApiError` so
 * callers can `try/catch` without re-reading `res.ok`.
 *
 * Resource layout (post US-020):
 *   - **"Meus Financiamentos"** — `tracker_plans` + `tracker_entries`, served
 *     under `/api/tracker/plans/*`. Use the `*TrackerPlan*` / `*TrackerEntry*`
 *     helpers below.
 *   - **Account** — `/api/account` (GET/PATCH/DELETE) and Better Auth's
 *     `/api/auth/*` (sign-in, sign-out, change-password, etc.).
 *   - **Simulator drafts** — `/api/drafts` (opaque JSON blob, one per user).
 */
import type { AuthSession, AuthUser } from "./auth-client";

// ---------------------------------------------------------------------------
// "Meus Financiamentos" resource. Backed by `tracker_plans` + `tracker_entries`
// and served under `/api/tracker/plans/*`.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Account management (US-015..US-019). Backed by `/api/account` and Better
// Auth's `/api/auth/*`. The SPA reads/updates the authenticated user's profile
// through these helpers and lets Better Auth handle email verification and
// password change.
// ---------------------------------------------------------------------------

export interface AccountApi {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  email?: string;
}

export interface UpdateAccountResponse {
  account: AccountApi;
  emailVerificationSent: boolean;
}

export async function getAccount(): Promise<AccountApi> {
  const body = await jsonFetch<{ account: AccountApi }>("/api/account");
  return body.account;
}

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<UpdateAccountResponse> {
  return jsonFetch<UpdateAccountResponse>("/api/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface DeleteAccountInput {
  password: string;
}

export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  await jsonFetch<{ success: true }>("/api/account", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
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
  return jsonFetch<DraftResponse>("/api/drafts");
}

/** Upserts the authenticated user's simulator draft (opaque JSON object). */
export async function putDraft(
  payload: object,
): Promise<{ draft: unknown; updated_at: number }> {
  return jsonFetch<{ draft: unknown; updated_at: number }>("/api/drafts", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
