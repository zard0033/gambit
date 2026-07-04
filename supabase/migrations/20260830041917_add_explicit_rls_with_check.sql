-- Harden RLS intent (拍板 2026-07-03): make WITH CHECK explicit on all 9 owner-scoped
-- policies. Postgres already derives an implicit WITH CHECK from USING when a policy
-- omits it (see supabase/README.md "RLS policy convention") — so this does NOT change
-- runtime behavior, it just makes the write-time check self-documenting instead of
-- relying on an implicit default that a future copy-pasted policy could silently drop.
-- USING conditions are copied verbatim from each table's original CREATE POLICY.

ALTER POLICY "Users access own rows" ON public.game_sessions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.skill_scores
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.lesson_progress
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.dungeon_progress
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.lesson_side_learned
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.in_progress_game
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.journal_entries
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.memory_summaries
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users access own rows" ON public.concept_deepened
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
