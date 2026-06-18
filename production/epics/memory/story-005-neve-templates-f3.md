# Story 005: Zero-AI Neve Templates (F3 + F4 fill) + Register / Banned-Token Lint

> **Epic**: memory
> **Status**: Ready
> **Layer**: Feature — Phase 2 Differentiation ① — Logic
> **Type**: Logic (deterministic template render + persona lint)
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-005
> **ADR**: ADR-0014

## Context

**GDD**: `design/gdd/memory.md` — **F3** (per-moment templates), F4 Step 4 (line fill), Rules 5/15, AC-11b; **Voice SoT** `design/gambit-design-system/persona-neve.md` §「回顧態」register
**Requirement**: `TR-memory-005`

**ADR Governing Implementation**: ADR-0014 §3 (Pillar-3 type discipline; zero-AI templates)
**ADR Decision Summary**:
- Every Neve sentence is `render(template_id, params)` — **no free-form generation, no network/API** (v1). Per-moment template keyed on `kind + concept`; the cross-game line template keyed on the F4 `NeveSignal.kind`.
- Phrase banks are small fixed maps per concept; piece/square/move tokens come from the analyzed line.

**Engine**: Web App — TypeScript (pure) | **Risk**: LOW
**Engine Notes**:
- 回顧態 register guardrails: "你"-subject, active voice, **never imputes intent** ("你想…" forbidden), mistakes neutral (no "blunder"/"錯"), good moves stated not gushed, plain kind = quietest phrasing.
- Move comparison strings (story-008 renders the layout): mistake `你走了 <played>` │ `更好的是 <best>`; good `你走了 <played> · 這手很好`. This story owns the **text**, story-008 owns the **visual differentiation**.

**Control Manifest Rules (this layer)**:
- Required: render is a pure deterministic function (same inputs → same string) for golden-file assertions.
- Required: CJK never italic (persona SoT); piece terms 后/城堡/騎士/主教/國王/兵 only (西洋棋用語護欄).
- Forbidden: any `fetch`/`supabase`/Claude API import (v1 zero-AI) — static grep.

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-11b**: every Neve sentence is template-derived (**assert no network/API call**) and obeys the banned-token lint (`['你想','blunder','錯','恭喜']`); F4 emits no weakest-stage line (joint with story-004 — assert the rendered output of every `NeveSignal.kind` is non-verdict).
- [ ] **F3 templates** render for each `kind+concept`: tactical/material, tactical/mate, bright, plain swing — each filled from a moment fixture, deterministic.
- [ ] **F4 line templates** render improving / recurring / neutral / first-or-few from a `NeveSignal` fixture.
- [ ] **Piece-term + CJK lint**: rendered strings use only 后/城堡/騎士/主教/國王/兵 for pieces; no emoji; no italic markup.

---

## Implementation Notes

```
src/modules/memory/templates.ts        ← renderMoment(moment, line): string ; renderNeveLine(signal): string ; phrase banks
src/lib/memory/persona-lint.ts         ← lintNeve(text): string[]  (banned tokens, emoji, piece-term, italic) — reuse journal lint if shaped to share
tests/unit/memory/templates.test.ts    ← golden-file per kind+concept + per signal kind
tests/unit/memory/persona-lint.test.ts ← banned tokens, no-network assertion (spy fetch), piece-term, CJK-no-italic
```

```
F3 (per-moment):
  tactical/material : "你的{piece}留在 {square}，沒人守著。與其走 {played}，不如先 {bestPhrase}——{bestRationale}。"
  tactical/mate     : "這裡你忽略了對手的將殺威脅。{played} 之後對手能{mateLine}；先 {best} 擋住。"
  bright            : "你{recoveryVerb}——把{piece}{playedPhrase}，{consequence}，奪回主導權。"
  plain swing       : "這裡沒有戰術可抓。你走 {played}，{drift}；先走 {best} 會穩一些。"
F4 (line):
  improving → "你最近{n}盤的{stage}，比之前穩了一些——我們慢慢練。"
  recurring → "{conceptPhrase}這個，我們之後可以一起多看幾次。"
  neutral   → "最近這幾盤都走得挺穩的。"
  first/few → a gentle single/first-game line
```

- Reuse the journal persona lint (`src/lib/journal/*` lint) if it can be generalized; otherwise a thin `src/lib/memory/persona-lint.ts` mirroring it. Don't duplicate the forbidden-token list — share one source.

---

## Out of Scope

- The F4 signal selection itself — story-004 (this story renders the signal it returns).
- The move-comparison **visual** (font-size/color/leading-word layout) — story-008 (this story = text only).

---

## QA Test Cases

**Gate level**: BLOCKING (Logic)

- **AC-11b**: golden strings per template; `lintNeve` over all of them returns `[]`; a deliberately-bad string ("你想…","恭喜","blunder","錯") → flagged. Spy `fetch`/network → asserted 0 calls during render.
- **F3/F4**: each `kind+concept` and each `NeveSignal.kind` → expected句 (golden file). Edge: `concept='mate'` template; `first-or-few` line.
- **CJK/piece**: a fixture forcing piece tokens → 城堡/騎士/主教 (never 車/馬/象); no emoji; no `*italic*`/`_italic_` wrapping on CJK.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/memory/{templates,persona-lint}.test.ts` pass (BLOCKING).
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-002 (moment kind/concept/tokens), story-004 (`NeveSignal`).
- Unlocks: story-007 (Neve card text), story-008 (per-moment explanation text).
