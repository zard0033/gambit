-- ADR-0014: 棋憶 (Memory, #22) data model.
-- One durable per-game summary feeding the F4 cross-game line — NOT a per-game moment cache.
-- Owner-scoped RLS; event-level idempotency UNIQUE(user_id, game_id) (one summary per game,
-- ON CONFLICT DO NOTHING — re-deriving the same game is a no-op; row-UUID idempotency does NOT
-- survive guest->login reconcile, same reason as journal_entries / ADR-0013).
-- `schema_version` is a top-level column so F4 can ignore summaries written under an incompatible
-- selection/stage tuning (degrade the window) rather than mix inconsistent data.
-- `game_id` is text with NO FK: a guest game has no game_sessions row, and the summary's lifecycle
-- is independent of game-history saving.
-- NOTE: timestamp 20260828000000 (not …827) — …827 is taken by Gambit-noir's user_preferences.

CREATE TABLE IF NOT EXISTS public.memory_summaries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),  -- client-generated
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id        text        NOT NULL,
  schema_version integer     NOT NULL,
  summary        jsonb       NOT NULL,   -- { stageCounts:{opening,middlegame,endgame}, conceptCounts:Record<concept,number>, anchorStage: stage|null }
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memory_summaries_game_unique UNIQUE (user_id, game_id)
);

ALTER TABLE public.memory_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.memory_summaries
  USING (user_id = auth.uid());
