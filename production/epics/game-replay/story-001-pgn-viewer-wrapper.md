# Story 001: pgn-viewer Vue 3 Wrapper Component

> **Epic**: game-replay
> **Sprint**: S10-01 (Must Have)
> **Status**: Complete
> **Layer**: Feature / UI Component
> **Type**: Component Integration
> **Estimate**: M (6 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0004, ADR-0007

## Context

**GDD**: design/gdd/game-replay.md (pending design-review)
**ADR**: N/A — `@lichess-org/pgn-viewer` is pre-approved in the Phase 2 tech stack (CLAUDE.md); no new architectural decision required for wrapping an approved library.
**Dependencies**: pgn-viewer (npm: @lichess-org/pgn-viewer) — already reserved in tech stack
**Story dependencies**: None — S10-01 is the entry story for the game-replay epic.
**Purpose**: Wrap pgn-viewer into a Vue 3 component that accepts a PGN string and emits move selection events

**Out of scope**: Move history display, evaluation overlay, game state management — owned by ReplayView (S10-02) and analysis overlay (S10-03).

**Control Manifest Rules** (Manifest Version: 2026-05-29):
- Touch targets ≥ 44×44px for any interactive elements inside the wrapper
- No hover-only interactions (mobile has no hover state)
- Component must be stateless — parent (ReplayView) manages selected move index

**Performance**: Component mount expected < 50ms; no frame budget impact during initial render. Touch/click events fire synchronously.

---

## Acceptance Criteria

- [ ] **AC-01**: PgnViewer.vue component renders without errors for valid PGN strings
- [ ] **AC-02**: Component emits `@move-selected` event when user selects a move
- [ ] **AC-03**: Component supports props: `pgn` (string), `orientation` ('white' | 'black')
- [ ] **AC-04**: Keyboard navigation works (arrow keys to move, space to select)
- [ ] **AC-05**: Touch support: tap square to select move
- [ ] **AC-06**: No console errors or warnings on mount/unmount

---

## Implementation Notes

### Files to Create

```
src/components/pgn-viewer.vue          ← wrapper component
tests/unit/components/pgn-viewer.test.ts ← unit tests
```

### Component Interface

```typescript
// Props
interface Props {
  pgn: string                          // Full PGN string
  orientation?: 'white' | 'black'      // Board orientation (default: white)
  highlighted?: string                 // Highlighted square (e.g., 'e4')
}

// Emits
type Emits = {
  'move-selected': [move: string]       // Emitted when user selects a move (e.g., 'e2e4')
}
```

### Testing Strategy

1. **Mount test**: Render with valid PGN, verify no errors
2. **Move selection**: Simulate click on pgn-viewer element, verify emit
3. **Orientation**: Test both 'white' and 'black' orientations
4. **Edge cases**: Invalid PGN (should not crash), empty string (fallback handling)

---

## QA Test Cases

**Gate level**: BLOCKING — 6 unit tests minimum

- AC-01 render: PgnViewer mounts with valid PGN
- AC-02 emit: Move selection emits event with correct move notation
- AC-03 props: Orientation prop changes board flip
- AC-04 keyboard: Arrow keys navigate, space selects
- AC-05 touch: Tap gesture selects move
- AC-06 cleanup: No console errors on unmount

---

## Test Evidence

**Story Type**: Component Integration
**Required Evidence**: `tests/unit/components/pgn-viewer.test.ts` (6/6 tests pass)

---

## Completion Criteria

- ✅ PgnViewer.vue created and exported
- ✅ All 6 unit tests passing
- ✅ No TypeScript errors
- ✅ Component can be imported in ReplayView without issues

---

## Notes

- pgn-viewer npm package may have its own types; use @types or declare module if needed
- Consider wrapping pgn-viewer's click/select handler to emit custom event (data normalization)
- Keep component stateless; parent (ReplayView) manages selected move

## Completion Notes
**Completed**: 2026-06-01
**Criteria**: 6/6 passing
**Deviations**: highlighted prop @deprecated (intentional); stale-closure bug fixed in code review
**Test Evidence**: Component Integration: tests/unit/components/pgn-viewer.test.ts (12/12 pass)
**Code Review**: Complete — stale closure fix applied (localViewer capture)
