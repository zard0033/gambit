-- Per-user appearance theme preference (cream / noir). One row per user; the client reconciles by
-- updated_at (last-write-wins) so the newest device's choice wins on login — same model as
-- in_progress_game (NOT monotonic, so row-UUID idempotency does not apply). RLS-scoped to the owner.
--
-- WARNING: this file is NOT applied to the live Supabase project by this commit.
-- Applying it (via the Dashboard SQL editor, per supabase/README.md) is required before
-- src/stores/data-sync.ts's loadThemePreference/upsertThemePreference will find the table.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme      text        NOT NULL DEFAULT 'cream',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_theme_check CHECK (theme IN ('cream', 'noir'))
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.user_preferences
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
