-- Drop unused tables (拍板 2026-07-03). Basis: zero references anywhere under src/
-- (grep for `skill_scores` / `lesson_side_learned` / their camelCase forms — no hits;
-- the only remaining mention is a code comment in ConceptMapView.vue noting the
-- side-door union "was removed").
--
-- skill_scores (20260821000001): append-only skill snapshot per game, never wired to
-- any read or write path in the app.
-- lesson_side_learned (20260824000000): superseded by concept_deepened (20260829000000)
-- per that table's own migration comment and supabase/README.md, which already marks
-- lesson_side_learned "DEPRECATED 2026-06-21" — decommissioned, no longer read/written.
--
-- WARNING: this file is NOT applied to the live Supabase project by this commit.
-- Applying it (via the Dashboard SQL editor, per supabase/README.md) permanently
-- deletes these two tables and any rows they still hold.

DROP TABLE IF EXISTS public.skill_scores;
DROP TABLE IF EXISTS public.lesson_side_learned;
