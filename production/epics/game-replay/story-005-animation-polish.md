# Story 005: Animation Polish for Replay Navigation

> **Epic**: game-replay
> **Sprint**: S10-05 (Nice to Have)
> **Status**: Deferred (2026-06-02) — nice-to-have, shipped without；2026-06-22（`66e17ae`）隨 ReplayView 退役而作廢：本 story 所指的 replay-analysis-overlay.vue 已全刪，不再有未來 polish sprint 可補做的對象
> **Layer**: Feature / Polish
> **Type**: Animation
> **Estimate**: S (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-02
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0004, ADR-0007

> **Deferral note (2026-06-02)**: Basic transitions are present (eval-bar width/colour
> 120ms in `replay-analysis-overlay.vue`; control-bar opacity/colour). The full spec
> (eval-bar opacity fade, best-move arrow slide-in, move-highlight crossfade, iPhone
> 60fps profiling) is ADVISORY (manual-visual, not automatable) and does not block the
> sprint. Moved to a future polish sprint. Sprint 10 ships without it.

## Context

**Depends on**: S10-03 (analysis overlay complete)
**Purpose**: Smooth transitions when stepping between moves during replay

---

## Acceptance Criteria

- [ ] **AC-01**: Eval bar fade-in/out as move changes (100ms)
- [ ] **AC-02**: Best move arrow slide-in from previous arrow location (200ms)
- [ ] **AC-03**: Move highlight in list crossfade (100ms)
- [ ] **AC-04**: All animations 60fps; no jank during rapid stepping

---

## Implementation

### CSS Transitions

```css
.eval-bar { transition: opacity 100ms ease-out; }
.arrow-overlay { transition: transform 200ms ease-out; }
.move-highlight { transition: background 100ms ease; }
```

### Performance

- Use `transform` + `opacity` only (no layout reflows)
- Test with `will-change: transform` if needed
- Profile on iPhone to ensure 60fps

---

## QA Test Cases

**Gate level**: ADVISORY — manual visual verification only (animations are not automatable)

- **AC-01**: Eval bar shows 100ms fade transition on move change (not an instant jump)
- **AC-02**: Best move arrow slides from previous position at 200ms (not a snap)
- **AC-03**: Move list highlight crossfades at 100ms
- **AC-04**: Hold arrow key for 3+ seconds — no stutter or dropped frames
- **AC-04 iPhone**: Profile on Safari DevTools — 60fps maintained throughout
- **CSS check**: Only `transform` and `opacity` animated — no `width`, `height`, `top`, or other layout properties

**Evidence**: Screen recording or screenshot comparison before/after transition (`production/qa/evidence/s10-05-animation-polish.*`)

---

## Test Evidence

**Required**: Manual visual test (screenshot comparison)

---

## Notes

- Defer: Piece animation during move (requires chessground API extension)
