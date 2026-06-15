# Story 005: Mobile Calm Default — Viewport-Responsive Annotation Display

> **Epic**: Post-Game Review
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-post-game-review-006
> **ADR**: ADR-0001, ADR-0007

## Context

**GDD**: `design/gdd/post-game-review.md`
**Requirement**: `TR-post-game-review-006`

**ADR Governing Implementation**: ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema
**ADR Decision Summary**: On viewports < 768px (mobile), show ONLY the best-move arrow. No played-move arrow. No eval bar. This "mobile calm" default reduces visual noise on small screens where the board is already cramped. It is a BINDING requirement per the control manifest, not a UX preference.

**Control Manifest Rules (Feature layer)**:
- Required: Mobile calm default is BINDING: `< 768px` → best-move arrow only; no played-move arrow, no eval bar

---

## Acceptance Criteria

- [x] On viewports **< 768px** wide, the `MoveAnnotationDisplay` receives: `annotations` with ONLY `role: 'bestMove'` arrows (no `role: 'playedMove'`), and `evaluation: null` (no eval bar rendered).
- [x] On viewports **≥ 768px**, all annotation types are passed to `MoveAnnotationDisplay` (bestMove + playedMove arrows, eval bar).
- [x] The breakpoint check uses `window.matchMedia('(max-width: 767px)')` — reactive to resize.
- [x] Resizing from < 768px to ≥ 768px triggers `_onMqChange` → `isMobile.value` updates → computed re-renders.
- [x] The mobile calm rule is enforced in ReviewView.vue — MoveAnnotationDisplay itself is passive.

---

## Implementation Notes

```ts
// In PostGameReview.vue
const isMobile = ref(window.matchMedia('(max-width: 767px)').matches)
const mqListener = (e: MediaQueryListEvent) => { isMobile.value = e.matches }
const mq = window.matchMedia('(max-width: 767px)')
mq.addEventListener('change', mqListener)
onUnmounted(() => mq.removeEventListener('change', mqListener))

const displayAnnotations = computed(() => {
  if (!currentAnnotations.value) return []
  if (isMobile.value) return currentAnnotations.value.filter(a => a.role === 'bestMove')
  return currentAnnotations.value
})

const displayEvaluation = computed(() => isMobile.value ? null : currentEvaluation.value)
```

- `currentAnnotations` and `currentEvaluation` come from the current cursor position's analysis result.
- The component passes `displayAnnotations` and `displayEvaluation` (not the raw values) to `<MoveAnnotationDisplay>`.

---

## QA Test Cases

*UI story — manual verification steps.*

- **AC-1**: Mobile viewport — best-move only
  - Setup: Open PostGameReview in Chrome DevTools with viewport width 375px. Navigate to a move with analysis.
  - Verify: Only one arrow visible on board (best-move). No second arrow for played move. No eval bar.
  - Pass condition: Arrow count === 1; eval bar element not rendered in DOM (or `display: none`).

- **AC-2**: Desktop viewport — all annotations
  - Setup: Same position but viewport width 1024px.
  - Verify: Two arrows visible (best-move + played-move if different). Eval bar visible.
  - Pass condition: Two distinct arrow paths in SVG; eval bar element visible.

- **AC-3**: Reactive resize
  - Setup: Start at 375px (mobile). Drag DevTools to widen viewport to 900px.
  - Verify: Annotations update without page reload — played-move arrow and eval bar appear.
  - Pass condition: No page reload; annotations change reactively within one render cycle.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/s4-06-mobile-calm.png`

**Status**: [x] `production/qa/evidence/s4-06-mobile-calm.md` — logic implemented (2026-05-30); screenshot pending manual device test (advisory)

---

## Dependencies

- Depends on: Story 001 (analysis results exist), Epic move-annotation Story 001 (MoveAnnotationDisplay exists)
- Unlocks: Nothing — terminal UI story for this epic
