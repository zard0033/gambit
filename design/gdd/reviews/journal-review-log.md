# Journal (棋誌) — Review Log

## Review — 2026-06-16 — Verdict: MAJOR REVISION NEEDED → revised same session
Scope signal: M (v1 after scope cut) / L (original six-pen scope)
Specialists: game-designer, systems-designer, qa-lead, ux-designer, creative-director (all via general-purpose loading project persona files)
Blocking items: 9 | Recommended: ~12

### Key findings
- **[VISION]** Cold-start had no guaranteed first beat — a real beginner could see an empty book for weeks (disproves "it remembers me").
- **[VISION]** `solace` at top priority (F2=4) inverted the emotional arc — a struggling beginner's journal became a list of consolations, reinforcing "I'm bad".
- **[DATA]** `②`'s `isPivotalOrBrilliant` was fabricated — Post-Game Review #7 exposes per-move `cpLoss` + one game-level `biggestSwingCursor` (the player's *worst* move), no per-move brilliant flag.
- **[DATA]** `①`'s inputs (`motif`, persisted `hintUsed`, per-answer solve event) do not exist on Lesson System #18 (`motif` is a puzzle attribute; #18 only persists `{completed: string[]}`).
- **[DATA]** "session" not deterministic on iOS Safari (no reliable app-close); ephemeral capture would lose entries on tab kill.
- **[DATA]** Idempotency must dedup on event (`source_ref_id`), not row UUID — else guest→login reconcile duplicates.
- **[QA]** AC1 hardcoded "歸卷二" contradicting F3; tone ACs (1/5/9/10) un-testable as prose; 6 missing blocking ACs.
- **[UX]** `/journal` route vs nav-and-routing's deferred tab bar; `②` deep-link targets a by-id replay route that doesn't exist until MVP; 未讀 state model undefined.

### Resolution (same session, Eason decisions)
- **v1 scope cut to 啟程(onset) + ④arrival + ⑤solace** — all reconstructible from persistent state (first-use flag, `lesson_progress.completed`, game-result sequence). `①②③⑥` deferred to Phase 2 (need upstream #18/#7 event interfaces or multi-month accumulation; `type` reserved, no migration).
- Added zero-gated `onset` pen (guaranteed first-session entry) — fixes cold-start.
- Rebalanced F2: `onset 5 > arrival 3 > solace 2`. **Then (Eason 2026-06-16) relaxed R4 from "≤1 per session" to `SESSION_ENTRY_CAP=3`**: F2 now writes the top-≤3 by priority, so in v1 (≤3 candidates ever) arrival AND solace co-exist rather than one suppressing the other — this supersedes the priority-suppression fix mechanism (both notes appear); priority now governs display order + Phase 2 (7-pen) truncation.
- R5 rewritten: v1 is derivable-not-ephemeral; lazy `evaluate()` on 4 triggers; no app-close dependency → **v1 has no "unsettled-candidate lost" failure**.
- ACs fully rewritten for v1 scope: testable, golden-`template_id` + forbidden-token/emoji/italic lint pattern; added onset-once, arrival dedup/carryover, solace cooldown-suppression + no-criticism lint, priority invariants, guest reconcile, order, no-edit, unread, reduced-motion.
- 未讀 mark pinned: device-local `journalLastSeenAt` watermark, binary (no count), non-gold, journal-view-only.
- `/journal` route pinned: single route + homepage peek, no early tab bar; HomeView owns the peek; must be registered in nav-and-routing route table (待補).
- Data model / idempotency / session boundary formalized in **ADR-0013** (`journal_entries` table, `UNIQUE(user_id, source_ref_id)`, lazy settle, `SESSION_IDLE_TIMEOUT` scoped to cooldown/carryover only).

Prior verdict resolved: First review.
Status after revision: Designed (v1) — ready for /create-stories on the onset/arrival/solace scope; ADR-0013 must be moved to Accepted before stories are *implemented*.
