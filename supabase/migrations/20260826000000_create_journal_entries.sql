-- ADR-0013: Journal (棋誌) data model.
-- Append-only, owner-scoped RLS, union-reconcile like lesson_progress.
-- Idempotency is EVENT-level: UNIQUE(user_id, source_ref_id) — NOT row-UUID
-- (ADR-0011's ON CONFLICT (id) does NOT survive the guest->login reconcile).
-- `type` is text (NOT a PG enum) so Phase 2 pens (epiphany/move/weakness-arc/retrospect)
-- need no migration. v1 writes only 'onset' | 'arrival' | 'solace'.

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),  -- client-generated
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text        NOT NULL,   -- 'onset' | 'arrival' | 'solace' | (P2) 'epiphany' | 'move' | 'weakness-arc' | 'retrospect'
  source_ref_id text        NOT NULL,   -- event key: onset='onset', arrival=stageId, solace=triggering gameId, (P2) epiphany=motifId, move='gameId:ply'
  volume        text,                   -- '卷一規則'|'卷二戰術'|'卷三開局'|'卷四殘局'; NULL for onset (not filed)
  template_id   text        NOT NULL,   -- which template句 produced body; golden-file + lint anchor (R9 zero-AI)
  params        jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- data injected into the template
  body          text        NOT NULL,   -- rendered Neve text snapshot; IMMUTABLE per R2
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_event_unique UNIQUE (user_id, source_ref_id)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.journal_entries
  USING (user_id = auth.uid());
