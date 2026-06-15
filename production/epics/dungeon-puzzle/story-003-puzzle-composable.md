# Story 003: use-dungeon-puzzle Composable (validation state machine)

> **Epic**: dungeon-puzzle
> **Sprint**: S13-03 (Must Have)
> **Status**: Complete (2026-06-05)
> **Layer**: Feature / Logic
> **Type**: Composable (pure-ish logic)
> **Estimate**: M (5 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (§3.4, §4.3, §5)
> **TR**: TR-dungeon-002, TR-dungeon-003, TR-dungeon-004, TR-dungeon-005
> **ADR**: ADR-0004, ADR-0009, ADR-0011, ADR-0012

## Context

**Depends on**: S13-01
**Purpose**: Encapsulate the per-puzzle solving state machine so it is unit-testable
independently of the view (project standard: public methods must be unit-testable).

---

## Acceptance Criteria

- [ ] **AC-01**: Given a puzzle, exposes reactive `phase` (`solving` | `solved`), current FEN, ply pointer, and `wrong` flag.
- [ ] **AC-02**: `submitMove({from,to,promotion?})` returns a result discriminating: `correct-advance` (multi-move, opponent reply follows), `correct-solved` (final), `wrong` (legal but off-line), keeping state on wrong.
- [ ] **AC-03**: Correctness = move equals `solution[ply]` (from/to/promotion). For `motif === 'mate-in-1'` with `acceptAnyMate`, correct iff the move is legal and `chess.isCheckmate()`.
- [ ] **AC-04**: On `correct-advance`, the scripted opponent reply (`solution[ply+1]`) is applied to the position and the pointer advances by 2.
- [ ] **AC-05**: On the final correct player move, `phase` becomes `solved`.
- [ ] **AC-06**: Illegal moves never reach the validator as "wrong" (chess.js legality gate first); a wrong-but-legal move leaves `phase`/pointer unchanged and sets `wrong`.

## Implementation Plan

- New `chess.js` instance per puzzle seeded from `fen`; non-reactive (ADR-0005).
- Pure logic returns results; the **view** owns the opponent-reply animation delay
  (`OPPONENT_REPLY_DELAY_MS` tuning) and the board re-render — the composable applies the
  reply to the chess.js position synchronously and the view animates the transition.
- Expose a `hintArrow` getter returning `solution[0]` as `{orig,dest}` for the view's
  second-stage hint.

## Test Evidence

**Required**: `tests/unit/modules/dungeon/use-dungeon-puzzle.test.ts` — single-move solve,
multi-move (mate-in-2) ply progression, acceptAnyMate vs strict, wrong-move keeps state,
promotion match/mismatch.

## Notes

- This is the single source of truth for GDD §3.4. The view is a thin presenter over it.
