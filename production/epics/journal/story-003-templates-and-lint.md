# Story 003: Zero-AI Templates + Persona Lint

> **Epic**: journal
> **Status**: Implemented (2026-06-16 — 26 unit tests green, vue-tsc 0; pending /story-done review)
> **Layer**: Phase 1 Differentiation — Logic / Content
> **Type**: Logic (deterministic render + lint) + Config/Data (template句庫)
> **Estimate**: M (3-4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-003
> **ADR**: ADR-0013

## Context

**GDD**: `design/gdd/journal.md` — R8 (persona alignment), R9 (zero AI), Open Questions (≥5 variants/pen), Visual/Audio (fonts)
**Requirement**: `TR-journal-003`

**ADR Governing Implementation**: ADR-0013 §1 (`template_id`+`params`+`body`)
**ADR Decision Summary**:
- Every entry's text is `render(template_id, params)` — a **deterministic** pure function (R9 zero-AI). The rendered `body` is stored as an **immutable snapshot** (R2); copy/lint tooling reads `template_id`+`params`, never re-renders a stored entry.
- This determinism is what makes tone ACs testable via golden-file + forbidden-token lint.

**Engine**: Web App — TypeScript | **Risk**: LOW
**Engine Notes**:
- Persona SoT: `design/gambit-design-system/persona-neve.md` (教學態, 第一人稱「我」對「你」, 平靜, 不反射式讚美, 西洋棋用語, 無 emoji, CJK 不斜體). ⑤ solace **永不批評**.
- Inject **specific** data into the sentence body (stage name, volume name, loss-span description) — not just a date stamp — so no two entries are structural twins (design-review: canned-feeling kills differentiation).

**Control Manifest Rules (this layer)**:
- Required: `render()` is pure and deterministic (same args → same body).
- Required: template句庫 is data (`data/journal-templates/*`), editable without touching code (data-driven rule).
- Forbidden: any LLM/network call in the render path (R9 zero AI, zero marginal cost).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-tone-lint**: for any entry — (a) `body === render(template_id, params)` (golden); (b) no emoji codepoint; (c) any piece name is one of 后/城堡/騎士/主教/國王/兵 (never 車/馬/象); (d) CJK text computed `font-style != italic`.
- [ ] **AC-solace-3**: any solace entry `body` contains none of {錯, 失誤, 應該, 不該, 漏, 可惜} and no cpLoss/eval numbers (forbidden-token — R8 永不批評).
- [ ] ≥5 句變體 per pen (onset / arrival / solace); selection of a variant is deterministic from `params` (e.g. hash of `source_ref_id`), so re-render is stable.
- [ ] Templates use chess piece terms + persona register; onset/arrival/solace each have a distinct voice (arrival 稍長回望; solace 溫柔不檢討).

---

## Implementation Notes

```
data/journal-templates/onset.ts          ← ≥5 variants; params: {} (or first-name-less greeting)
data/journal-templates/arrival.ts         ← ≥5 variants; params: {stageName, volumeName}
data/journal-templates/solace.ts          ← ≥5 variants; params: {lossSpan} — NO numbers, NO blame
src/lib/journal/render.ts                 ← render(template_id, params): string (pure, deterministic variant pick)
src/lib/journal/persona-lint.ts           ← forbiddenTokens, emoji regex, piece-term whitelist, solace blame list
tests/unit/journal/render.test.ts         ← golden snapshots per template_id
tests/unit/journal/persona-lint.test.ts   ← every template passes lint; solace blame list enforced
tests/unit/data/journal-templates.test.ts ← ≥5 variants/pen, all lint-clean
```

```typescript
const SOLACE_FORBIDDEN = ['錯', '失誤', '應該', '不該', '漏', '可惜']
const PIECE_TERMS = ['后', '城堡', '騎士', '主教', '國王', '兵']
const XIANGQI_BANNED = ['車', '馬', '象']           // these are forbidden even as piece names
// emoji: /\p{Extended_Pictographic}/u
```

- CJK-not-italic is enforced in CSS (story-004 view), but the lint here asserts no template emits markup that would italicize; the runtime computed-style check lives in the view test (story-004 AC). Keep this story's lint to text-content rules.
- Variant pick: `variants[hashInt(source_ref_id) % variants.length]` — stable across re-renders, varied across entries.

---

## Out of Scope

- story-004: the computed `font-style != italic` DOM assertion (rendered in the view).
- story-002: which pen/params get rendered (this story renders what 002 supplies).
- Phase 2 pens' templates (epiphany/move/weakness-arc/retrospect).

---

## QA Test Cases

**Gate level**: BLOCKING (Logic) for render + lint; Config smoke for句庫 count.

- **AC-tone-lint (a)**: golden snapshot — `render('arrival.v1', {stageName:'規則', volumeName:'卷一'})` equals fixed string.
- **AC-tone-lint (b/c)**: run persona-lint over every template variant → zero emoji, zero 車/馬/象, piece names ⊆ whitelist.
- **AC-solace-3**: every solace variant contains no blame token and no digit. Edge: a `lossSpan` param must not inject a number into body.
- **≥5 variants**: assert `onset.length≥5 && arrival.length≥5 && solace.length≥5`.

---

## Test Evidence

**Story Type**: Logic (+ Config/Data smoke)
**Required evidence**: `tests/unit/journal/{render,persona-lint}.test.ts` + `tests/unit/data/journal-templates.test.ts` pass (BLOCKING).
**Status**: [x] Done — 26 tests pass (persona-lint 9 / render 9 / journal-templates 8), vue-tsc 0 (2026-06-16).
**Files**: `src/types/journal.ts`, `src/data/journal-templates/{onset,arrival,solace,index}.ts`, `src/lib/journal/{render,persona-lint}.ts`. (Templates at `src/data/` per project convention, not GDD-literal `data/`.)

---

## Dependencies

- Depends on: none (pure; can build before 001/002 land). story-002 consumes `render`.
- Unlocks: story-002 (body), story-004 (display).
