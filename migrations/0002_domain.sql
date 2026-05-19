-- Domain schema for the calculator's persisted state.
-- Two tables:
--   * financing_scenarios — one row per financing the user is tracking.
--   * payment_history     — chronological record of real payments per scenario.
-- Multi-tenancy is enforced by financing_scenarios.user_id (FK to Better Auth's
-- "user" table). All money is stored as integer cents and rates as basis points
-- (1 bp = 0.01%) so the engine can rebuild Decimal.js values losslessly.

create table "financing_scenarios" (
  "id" text not null primary key,
  "user_id" text not null references "user" ("id") on delete cascade,
  "name" text,
  "property_value_cents" integer not null,
  "down_payment_cents" integer not null,
  "term_months" integer not null,
  "annual_rate_basis_points" integer not null,
  "start_date" text not null,
  "created_at" integer not null,
  "archived_at" integer
);

create table "payment_history" (
  "id" text not null primary key,
  "scenario_id" text not null references "financing_scenarios" ("id") on delete cascade,
  "reference_month" text not null,
  "payment_date" text not null,
  "amount_paid_cents" integer not null,
  "payment_type" text not null,
  "amortization_strategy" text not null,
  "notes" text,
  "created_at" integer not null
);

create index "idx_scenarios_user" on "financing_scenarios" ("user_id");

create index "idx_payments_scenario_month" on "payment_history" ("scenario_id", "reference_month");
