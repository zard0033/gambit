# Story 003: History Row Expand Summary

> **Epic**: game-history
> **Sprint Task**: S8-05
> **Status**: Complete
> **Layer**: MVP Feature — UI Interaction
> **Type**: UI (Vue component interaction)
> **Estimate**: S (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0005, ADR-0011

## Context

**GDD**: `design/gdd/game-history.md` — Detailed Design §8 (Row expand), §3a (touch targets), §3c (scroll disambiguation)
**Requirements**: AC-12b

**ADR Governing Implementation**: ADR-0005 (Pinia Store Boundaries)
**ADR Decision Summary**: Expanded-row state tracked as `expandedRowId: string | null` in `useGameHistoryStore` (not local component state) so that single-row invariant is enforced globally without prop drilling.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Tailwind CSS | **Risk**: LOW — iOS Safari touch disambiguation is the main platform concern
**Engine Notes**:
- iOS: record `touchstartY` on `touchstart`; on `touchend`, only toggle if `|touchendY - touchstartY| < 4px`
- Do NOT use `click` event alone on iOS — brief scrolls often register as clicks
- `pointer-events` and `touch-action` CSS do NOT solve this; only the delta check does
- See feedback memory: `scrollintoview-ios-webkit-bug` and `ios-touch-control-css-first`

**Control Manifest Rules**:
- Required: Touch drag ≥ 4px vertical → does NOT toggle row (scroll disambiguation)
- Required: Only one row expanded at a time (tapping second row collapses first)
- Required: Entire row area is the tap target (not only a disclosure chevron)
- Required: Expanded panel shows `moveCount`, `endReasonDisplay`, `difficultyLabel`, `playerColor`

---

## Acceptance Criteria

- [x] **AC-12b** (ADVISORY — Playwright): Single-row invariant enforced via `setExpandedRow()` in store; unit tested (3 cases).
- [x] **iOS scroll disambiguation**: `onTouchEnd` checks delta < 4px before toggling; implemented in history-row.vue.
- [x] **Touch target**: `@click` and `@touchend` both on root row div (full tap area).
- [x] **Expanded panel content**: Expanded panel shows `moveCount`, `endReasonDisplay`, `difficultyLabel`, `playerColor` (covered by AC-12 in S8-04).
- [x] **Collapse on second tap**: `setExpandedRow(id)` when already-expanded → null (unit tested).

---

## Implementation Notes

### Files to modify

```
src/stores/game-history.ts          ← add expandedRowId state + setExpandedRow() action
src/components/history-row.vue      ← add touch disambiguation + expanded panel
tests/e2e/game-history.spec.ts      ← new Playwright interaction test (ADVISORY)
```

### Expanded row state in useGameHistoryStore

```typescript
// Add to GameHistoryState:
expandedRowId: string | null  // null = no row expanded

// Add action:
setExpandedRow(id: string | null): void {
  this.expandedRowId = this.expandedRowId === id ? null : id
}
```

### Touch disambiguation (history-row.vue)

```typescript
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const delta = Math.abs(e.changedTouches[0].clientY - touchStartY)
  if (delta < 4) {
    historyStore.setExpandedRow(props.entry.id)
  }
}
```

Attach `@touchstart="onTouchStart"` and `@touchend.prevent="onTouchEnd"` to the row element.
Keep `@click="() => historyStore.setExpandedRow(entry.id)"` for mouse users (desktop).

### Expanded panel template

```vue
<template #expanded>
  <dl v-if="isExpanded" class="expanded-panel">
    <dt>Moves</dt><dd>{{ entry.moveCount }}</dd>
    <dt>Result</dt><dd>{{ entry.endReasonDisplay }}</dd>
    <dt>Difficulty</dt><dd>{{ entry.difficultyLabel }}</dd>
    <dt>Played as</dt><dd>{{ entry.playerColor }}</dd>
  </dl>
</template>
```

---

## QA Test Cases

**Gate level**: ADVISORY — Playwright interaction test

Playwright test (`tests/e2e/game-history.spec.ts`):
- Navigate to `/history` (with seeded mock data or real auth)
- Tap row 1 → assert expanded panel visible with correct fields
- Tap row 2 → assert row 2 expanded, row 1 collapsed
- Simulate ≥ 4px vertical drag on row 3 → assert row 3 NOT expanded

---

## Test Evidence

**Story Type**: UI Interaction
**Required evidence**:
- ADVISORY: Playwright interaction test (AC-12b + scroll disambiguation)
- BLOCKING gate from story-002: AC-12 expanded panel DOM wiring must already pass before this story ships

---

## Dependencies

- Depends on: story-002-history-view.md (history-row.vue exists; expansion state in store)
- No downstream unlocks in Sprint 8
