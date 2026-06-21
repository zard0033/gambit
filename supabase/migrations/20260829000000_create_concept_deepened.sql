-- Concept deepening completions (quick-specs/concept-deepening-page.md). Row existence = the player
-- finished a concept's deepening page (`/learn/concept/:id`). Kept in a SEPARATE table from
-- lesson_progress on purpose: deepening is its own quiet state and must NEVER feed linear unlock /
-- progression (mirrors the lesson_side_learned separate-signal pattern it replaces). Monotonic,
-- per-user, RLS-scoped to the owner.
CREATE TABLE IF NOT EXISTS public.concept_deepened (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id   text        NOT NULL,
  deepened_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT concept_deepened_pkey PRIMARY KEY (user_id, concept_id)
);

ALTER TABLE public.concept_deepened ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.concept_deepened
  USING (user_id = auth.uid());
