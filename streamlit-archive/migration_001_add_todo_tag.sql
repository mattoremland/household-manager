-- Migration: add optional "tag" (assignee) field to todo_items.
-- Run once in the Supabase SQL Editor: Project -> SQL Editor -> New query -> paste -> Run
-- (schema.sql already reflects this for anyone setting the DB up fresh.)

alter table todo_items add column if not exists tag text;

-- Optional: Chores was dropped from the plan (folded into Lists instead — see
-- pages/2_Lists.py). These two tables were created in Stage 3 but are now unused
-- by the app. Uncomment and run if you want to remove them from the database too
-- (this permanently deletes any chore data already in them):
-- drop table if exists chore_log;
-- drop table if exists chores;
