-- Acompanhamento (financing tracker) schema.
-- Two tables:
--   * tracker_plans   — one row per financing plan the user is tracking.
--   * tracker_entries — manual monthly payment entries applied to a plan.
-- Money is stored as integer cents and rates as basis points (1 bp = 0.01%) so
-- the engines in core/finance/tracker can rebuild Decimal.js values losslessly.
-- target_monthly_total_cents is the fixed total (installment + extra) for the
-- "Meta" curve. apply_mode decides whether a payment's surplus shortens the term
-- or reduces the following installments.

create table "tracker_plans" (
  "id" text not null primary key,
  "user_id" text not null references "user" ("id") on delete cascade,
  "name" text not null,
  "property_value_cents" integer not null,
  "down_payment_cents" integer not null,
  "term_months" integer not null,
  "annual_rate_bp" integer not null,
  "modality" text not null check ("modality" in ('PRICE', 'SAC')),
  "start_date" text not null,
  "target_monthly_total_cents" integer not null,
  "created_at" integer not null,
  "updated_at" integer not null
);

create table "tracker_entries" (
  "id" text not null primary key,
  "plan_id" text not null references "tracker_plans" ("id") on delete cascade,
  "month_index" integer not null,
  "paid_amount_cents" integer not null,
  "paid_at" text not null,
  "apply_mode" text not null check ("apply_mode" in ('reduce_term', 'reduce_installment')),
  "note" text,
  "created_at" integer not null,
  unique ("plan_id", "month_index")
);

create index "tracker_plans_user_id_idx" on "tracker_plans" ("user_id");

create index "tracker_entries_plan_id_idx" on "tracker_entries" ("plan_id", "month_index");
