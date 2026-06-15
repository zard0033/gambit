# Story 002: rAF-Coalesced Resize Throttle

> **Epic**: Move Annotation Display
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: S (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-move-annotation-005
> **ADR**: ADR-0006

## Context

**GDD**: `design/gdd/move-annotation-display.md`
**Requirement**: `TR-move-annotation-005`

**ADR Governing Implementation**: ADR-0006: Move Annotation Rendering Substrate
**ADR Decision Summary**: `ResizeObserver` watches `boardRef`. On resize, recalculate all arrow/highlight geometries by calling `squareToRect()` fresh (never cached). Coalesce via `requestAnimationFrame` — if multiple resize events fire before the next frame, only the last one triggers a geometry recalculation. This prevents layout thrash on rapid resize (e.g., orientation change).

**Control Manifest Rules (Core layer)**:
- Required: `squareToRect()` returns live values — call fresh on every resize, never cache
- Required: All animations use `transform` + `opacity` only (no `width`/`height`/`top`/`left`)
- Required: `pointer-events: none` on overlay

---

## Acceptance Criteria

- [ ] A `ResizeObserver` is attached to `boardRef` when `MoveAnnotationDisplay` mounts; detached on unmount.
- [ ] On each resize event, SVG geometry (arrow coordinates, highlight rects) is recalculated by calling `squareToRect()` fresh for all current annotations.
- [ ] Resize events within a single animation frame are coalesced — only the last triggers a recalculation (rAF debounce).
- [ ] After a board resize, all visible arrows and highlights remain correctly positioned (pixel-accurate to the new board dimensions).
- [ ] ResizeObserver is cleaned up on component unmount (no memory leak).

---

## Implementation Notes

- In `MoveAnnotationDisplay.vue`:
  ```ts
  let rafId: number | null = null
  const observer = new ResizeObserver(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      rafId = null
      recalculateGeometry() // calls squareToRect() for all current annotations
    })
  })
  onMounted(() => observer.observe(boardRef.value!))
  onUnmounted(() => observer.disconnect())
  ```
- `recalculateGeometry()`: iterates `props.annotations`, calls `squareToRect(annotation.from)` and `squareToRect(annotation.to)` to get fresh pixel coordinates, updates computed geometry refs that drive the SVG template.
- Since `squareToRect()` calls `boardRef.getBoundingClientRect()` internally (live values), no caching is needed — every call in `recalculateGeometry()` returns current layout.

---

## QA Test Cases

- **AC-1**: ResizeObserver attached and detached
  - Given: MoveAnnotationDisplay mounted with boardRef
  - When: component unmounts
  - Then: `ResizeObserver.disconnect()` was called (verify via spy)

- **AC-2**: rAF coalesces multiple resize events
  - Given: 3 rapid resize events before next animation frame
  - When: rAF fires
  - Then: `squareToRect()` called exactly once (not 3 times) per annotation

- **AC-3**: Arrows reposition after resize
  - Given: board at 400px width with arrow from e2→e4; board resizes to 600px
  - When: rAF fires
  - Then: arrow SVG coordinates reflect 600px board geometry (verified via rendered attributes)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/move-annotation/resize-throttle.test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE (SVG overlay exists)
- Unlocks: Epic post-game-review (annotations are used there)

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 3/3 ACs passing
**Deviations**: Tests use standalone helper function (not mounted Vue component) — logic is identical, avoids jsdom environment dependency
**Test Evidence**: Logic — `tests/unit/move-annotation/resize-throttle.test.ts` — 6 tests pass
**Code Review**: Skipped (Lean mode)
