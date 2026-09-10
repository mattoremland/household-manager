-- Migration: add optional "source_url" to meal_plan (Stage 8).
-- Run once in the Supabase SQL Editor: Project -> SQL Editor -> New query -> paste -> Run
-- (schema.sql already reflects this for anyone setting the DB up fresh.)
-- Holds the recipe link a meal's ingredients were scraped from.

alter table meal_plan add column if not exists source_url text;
