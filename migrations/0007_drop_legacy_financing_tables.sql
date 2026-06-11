-- US-020: drop the legacy financing model now that the canonical tracker
-- model (tracker_plans + tracker_entries) is the only resource backing
-- "Meus Financiamentos". The US-006 migration already copied any existing
-- rows over; this migration is the physical cutover.
--
-- Indexes on these tables are dropped automatically by SQLite when their
-- parent table is dropped (DROP TABLE removes associated indexes), so no
-- separate "drop index" statements are needed.
--
-- payment_history is dropped before financing_scenarios because it holds a
-- foreign key into the parent (ON DELETE CASCADE — order would still work,
-- but dropping the child first matches the intent and is explicit).

drop table if exists "payment_history";
drop table if exists "financing_scenarios";
