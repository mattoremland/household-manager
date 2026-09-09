-- Migration: add optional "ingredients" field to meal_plan (Stage 8).
-- Run once in the Supabase SQL Editor: Project -> SQL Editor -> New query -> paste -> Run
-- (schema.sql already reflects this for anyone setting the DB up fresh.)
-- One ingredient per line; the Grocery & Meals page turns these into grocery items.

alter table meal_plan add column if not exists ingredients text;
