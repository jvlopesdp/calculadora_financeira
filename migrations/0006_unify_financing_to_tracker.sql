-- US-006: unify "Histórico" (financing_scenarios + payment_history) into the
-- canonical "tracker" model (tracker_plans + tracker_entries).
--
-- The tracker_* tables are the canonical home for a user's financings going
-- forward. This migration copies any pre-existing rows from the legacy tables
-- so the new "Meus Financiamentos" UI sees the same data, *without* dropping
-- the legacy tables — keeping them around enables a safe rollback inside this
-- release. Physical removal of the legacy schema happens in a later migration
-- (see US-020).
--
-- Field mapping (financing_scenarios -> tracker_plans):
--   id                          -> id                 (same uuid; INSERT OR IGNORE so a
--                                                      user that already had a tracker
--                                                      plan with the same id is untouched)
--   user_id                     -> user_id
--   name (nullable)             -> name               (COALESCE to "Financiamento" — the
--                                                      tracker schema requires NOT NULL)
--   property_value_cents        -> property_value_cents
--   down_payment_cents          -> down_payment_cents
--   term_months                 -> term_months
--   annual_rate_basis_points    -> annual_rate_bp     (same unit: 1 bp = 0.01%)
--   start_date                  -> start_date
--   (no modality column)        -> modality           (default 'PRICE'; legacy scenarios
--                                                      assumed PRICE — SAC was never
--                                                      persisted in financing_scenarios)
--   (no target column)          -> target_monthly_total_cents
--                                                     (placeholder: principal divided by
--                                                      term; users can adjust in the new
--                                                      "Meta" UI. We avoid the PRICE
--                                                      installment formula here because
--                                                      SQLite/D1 has no portable POW.)
--   created_at                  -> created_at
--   created_at                  -> updated_at         (no separate updated_at on legacy)
--
-- Field mapping (payment_history -> tracker_entries):
--   id                          -> id                 (same uuid; INSERT OR IGNORE)
--   scenario_id                 -> plan_id            (we reuse the scenario id as
--                                                      the plan id above)
--   reference_month (YYYY-MM)   -> month_index        (1-based offset from the parent
--                                                      financing_scenarios.start_date —
--                                                      see arithmetic below)
--   amount_paid_cents           -> paid_amount_cents
--   payment_date                -> paid_at
--   amortization_strategy       -> apply_mode         ('prazo' -> 'reduce_term',
--                                                      'parcela' -> 'reduce_installment')
--   notes                       -> note
--   created_at                  -> created_at
--
-- Duplicate handling: tracker_entries has UNIQUE(plan_id, month_index). The
-- legacy payment_history does not enforce uniqueness per (scenario, month), so
-- in the rare case of duplicates one row wins via INSERT OR IGNORE. No data is
-- lost from the system: the originals stay in payment_history for rollback /
-- reconciliation until US-020 drops them.

insert or ignore into "tracker_plans" (
  "id",
  "user_id",
  "name",
  "property_value_cents",
  "down_payment_cents",
  "term_months",
  "annual_rate_bp",
  "modality",
  "start_date",
  "target_monthly_total_cents",
  "created_at",
  "updated_at"
)
select
  "id",
  "user_id",
  coalesce("name", 'Financiamento'),
  "property_value_cents",
  "down_payment_cents",
  "term_months",
  "annual_rate_basis_points",
  'PRICE',
  "start_date",
  ("property_value_cents" - "down_payment_cents") / "term_months",
  "created_at",
  "created_at"
from "financing_scenarios"
where "archived_at" is null;

-- month_index = ((ref_year - start_year) * 12 + (ref_month - start_month)) + 1
-- (1-based: a payment whose reference_month equals the start month is month 1)
insert or ignore into "tracker_entries" (
  "id",
  "plan_id",
  "month_index",
  "paid_amount_cents",
  "paid_at",
  "apply_mode",
  "note",
  "created_at"
)
select
  ph."id",
  ph."scenario_id",
  (
    (cast(substr(ph."reference_month", 1, 4) as integer)
       - cast(substr(fs."start_date", 1, 4) as integer)) * 12
    + (cast(substr(ph."reference_month", 6, 2) as integer)
       - cast(substr(fs."start_date", 6, 2) as integer))
    + 1
  ),
  ph."amount_paid_cents",
  ph."payment_date",
  case ph."amortization_strategy"
    when 'prazo' then 'reduce_term'
    when 'parcela' then 'reduce_installment'
  end,
  ph."notes",
  ph."created_at"
from "payment_history" ph
join "financing_scenarios" fs on fs."id" = ph."scenario_id"
where ph."amortization_strategy" in ('prazo', 'parcela')
  and exists (
    select 1 from "tracker_plans" tp where tp."id" = ph."scenario_id"
  );
