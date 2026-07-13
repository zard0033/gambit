# Story 004: Game-Level Rating / Notes UI

> **Epic**: game-replay
> **Sprint**: S10-04 (Should Have)
> **Status**: Done (2026-06-02) — 退役 2026-06-22（`66e17ae`）：game-replay-rating.vue 隨 ReplayView 一併全刪，未見替代功能
> **Layer**: Feature / User Data
> **Type**: UI + LocalStorage
> **Estimate**: S (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-02
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0004, ADR-0007

> **Completion note (2026-06-02)**: `game-replay-rating.vue` 已實作並整合進 ReplayView。
> 補上 BLOCKING 單元測試 `tests/unit/components/game-replay-rating.test.ts`（6 tests：save / load /
> deselect / notes 200-char 截斷 / localStorage 失敗不崩 / empty state）。
> ⚠️ 文件不一致：AC-01 文字寫 storage key `pgr:rating:${gameId}`，但 Data Model + QA cases 寫
> `pgr:replay:${gameId}`；實作採用 `pgr:replay:`（與 QA cases 一致），測試據此撰寫。

## Context

**Depends on**: S10-03 (analysis overlay complete)
**Purpose**: Let players rate/annotate replayed games for personal learning tracking

---

## Acceptance Criteria

- [ ] **AC-01**: Rating panel appears below replay controls (stars or emoji: 😞 😐 😊 😄 😍)
- [ ] **AC-02**: User can click to rate; rating persists to localStorage key `pgr:rating:${gameId}`
- [ ] **AC-03**: On reload, previously saved rating loads and displays
- [ ] **AC-04**: Optional notes field (text area, max 200 chars)
- [ ] **AC-05**: Mobile touch-friendly: tap star to rate, tap notes to edit

---

## Implementation

### Data Model

```typescript
interface GameReplay {
  gameId: string
  rating: 1 | 2 | 3 | 4 | 5  // 1=poor, 5=excellent
  notes: string               // <= 200 chars
}

// Store in localStorage as: pgr:replay:${gameId}
```

### UI

- Rating: 5 star icons (SVG or emoji)
- Notes: `<textarea>` below rating, placeholder text
- No validation errors (optional field)

---

## QA Test Cases

**Gate level**: BLOCKING — unit tests for localStorage read/write

- **AC-02 save**: Click star 3 → assert `localStorage.getItem('pgr:replay:${gameId}')` contains `{ rating: 3 }`
- **AC-03 load**: Set localStorage before mount → component renders correct selected star state
- **AC-02 deselect**: Click already-selected star → assert localStorage updated with cleared rating
- **AC-04 notes**: Type 200-char string in textarea → blur → localStorage updated; type 201st char → truncated or rejected

**Edge cases**:
- `gameId` undefined → no localStorage write; no crash
- localStorage unavailable (throws) → silent failure; UI still renders

---

## Test Evidence

**Required**: Unit test `tests/unit/components/game-replay-rating.test.ts` (4+ tests)

---

## Notes

- Defer: Sync to Supabase (Phase 2b)
- Defer: Stats aggregation (best/worst games, learning trends)
