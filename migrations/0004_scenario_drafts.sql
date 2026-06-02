-- One persisted draft per user: the latest unsaved simulator state.
-- The payload is opaque JSON (the API validates only that it is an object);
-- updated_at is epoch-ms. user_id is the primary key so each user has at most
-- one draft (upserted on save).

create table "scenario_drafts" (
  "user_id" text not null primary key references "user" ("id") on delete cascade,
  "payload" text not null,
  "updated_at" integer not null
);
