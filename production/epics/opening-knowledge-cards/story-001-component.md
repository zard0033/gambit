# Story 001: OpeningKnowledgeCard.vue Component + PostGameReview Integration

> **Epic**: Opening Knowledge Cards
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI + Logic
> **Estimate**: M (6–8 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: TR-opening-knowledge-cards-001, TR-opening-knowledge-cards-002, TR-opening-knowledge-cards-003, TR-opening-knowledge-cards-004
> **ADR**: ADR-0003

## Context

**GDD**: `design/gdd/opening-knowledge-cards.md`
**Requirements**: OKC-01, OKC-02, OKC-03, OKC-04

**ADR Governing Implementation**: ADR-0003: chess-openings Dataset Pin and EPD Index
**ADR Decision Summary**: `openingResult.eco` produced by `identifyOpening()` from OpeningIndex is the lookup key. No new ADR needed — this feature is data-only (static TypeScript map, no architecture decisions beyond the ECO key contract).

**Engine**: Web App — Vue 3 Composition API + TypeScript | **Risk**: LOW
**Engine Notes**: No Worker, no Pinia store, no runtime fetch. Build-time static module. `OPENING_CARDS` in `src/data/opening-knowledge-cards.ts` is already present with 10 cards.

**Control Manifest Rules (Feature layer)**:
- Required: `OPENING_CARDS[openingResult.eco] ?? null` — never throw on missing key
- Required: Collapse by default on mobile (< 768px); expand on desktop (≥ 768px)
- Required: Header element has `role="button"` and `tabindex="0"`; responds to `Space` and `Enter`
- Required: Markdown rendering is inline-only (`**bold**`, `_italic_`, plain text) — no `innerHTML`, no `v-html` with raw card content
- Required: Toggle state is session-ephemeral — reset on each new review session
- Forbidden: Never pass raw card body to `innerHTML` directly
- Forbidden: No new Pinia store, no Worker, no runtime fetch for card data

---

## Acceptance Criteria

- [ ] **AC-01**: For `eco = 'C50'` (Italian Game), `<OpeningKnowledgeCard>` renders beneath the opening header on the Review screen, displaying the card body text.
- [ ] **AC-02**: For `openingResult.eco === null` (unknown opening), no card panel DOM element is present.
- [ ] **AC-03**: For an ECO code with no authored card (e.g. `eco = 'A99'`), no card panel DOM element is present — same as AC-02.
- [ ] **AC-04**: On mobile viewport (< 768 px), the card panel is collapsed by default; tapping the opening header expands it.
- [ ] **AC-05**: On desktop viewport (≥ 768 px), the card panel is expanded by default; clicking the opening header collapses it.
- [ ] **AC-06**: Card body renders `**bold**` and `_italic_` correctly; raw HTML in a card body is not injected into the DOM.

---

## Implementation Notes

### New files to create

```
src/components/opening-knowledge-card.vue
tests/unit/opening-knowledge-cards/opening-knowledge-card.test.ts
```

### Component interface

```typescript
// Props
interface Props {
  eco: string | null          // openingResult.eco from ReviewView
  openingName: string | null  // opening display name for aria label
}
```

### Markdown renderer (inline-only, no v-html)

Parse `body` into a list of spans — avoid `v-html` or `innerHTML`. A minimal inline renderer:

```typescript
// Returns array of { text: string, bold: boolean, italic: boolean }
function parseInlineMarkdown(body: string): Span[]
```

Use `v-for` with `:class="{ 'font-bold': span.bold, italic: span.italic }"`.

### PostGameReview integration (ReviewView.vue)

Insert `<OpeningKnowledgeCard>` directly beneath the existing opening header block (line ~221):

```html
<!-- Opening header (AC-8, AC-9, AC-10) -->
<div v-if="openingHeader" ...>{{ openingHeader }}</div>

<!-- Knowledge card (OKC-01, OKC-02, OKC-03) -->
<OpeningKnowledgeCard
  :eco="openingResult?.eco ?? null"
  :opening-name="openingResult?.name ?? null"
/>
```

### Collapse/expand

Use a single `isExpanded` ref. Default: `window.matchMedia('(min-width: 768px)').matches`. The header acts as the toggle button — same element as the opening name display, or a wrapping button element.

---

## QA Test Cases

**Gate level**: BLOCKING — `tests/unit/opening-knowledge-cards/opening-knowledge-card.test.ts` must pass.

- **AC-01**: Known eco renders card
  - Given: `eco = 'C50'`
  - When: component mounts
  - Then: card panel DOM present; body text includes 'Italian'

- **AC-02**: Null eco → no DOM (EC-01)
  - Given: `eco = null`
  - When: component mounts
  - Then: no card panel element in DOM; no placeholder div

- **AC-03**: Unknown eco → no DOM (EC-02)
  - Given: `eco = 'A99'` (no entry in OPENING_CARDS)
  - When: component mounts
  - Then: no card panel element in DOM; identical to AC-02

- **AC-04**: Mobile default collapsed
  - Given: mock `window.matchMedia` returns `matches = false` (< 768px)
  - When: component mounts
  - Then: card panel is hidden by default; click header → visible; click again → hidden

- **AC-05**: Desktop default expanded
  - Given: mock `window.matchMedia` returns `matches = true` (≥ 768px)
  - When: component mounts
  - Then: card panel is visible by default; click header → hidden; click again → visible

- **AC-06**: HTML not injected (EC-03)
  - Given: card body contains `<script>alert(1)</script>`
  - When: rendered
  - Then: no script element in DOM; text appears escaped as literal string

- **parseInlineMarkdown — bold**
  - Given: `'**bold** text'`
  - Then: span with `bold: true` for 'bold'; span with no flags for ' text'

- **parseInlineMarkdown — italic**
  - Given: `'_italic_ text'`
  - Then: span with `italic: true` for 'italic'; span with no flags for ' text'

- **parseInlineMarkdown — plain**
  - Given: `'plain text'`
  - Then: single span with `bold: false`, `italic: false`

- **EC-04 ephemeral toggle**
  - Given: component mounted once with `eco = 'C50'`, toggle state changed
  - When: component unmounted and remounted fresh
  - Then: `isExpanded` resets to matchMedia default (not the previous toggle state)

---

## Test Evidence

**Story Type**: UI + Logic
**Required evidence**: `tests/unit/opening-knowledge-cards/opening-knowledge-card.test.ts` (unit, BLOCKING)
**Manual evidence**: Playwright screenshot showing card below opening header on ReviewView (advisory)

---

## Dependencies

- Depends on: Epic chess-engine Story 003 (reviewEngine), Epic post-game-review Story 001 (ReviewView.vue exists ✅)
- Depends on: `src/data/opening-knowledge-cards.ts` (10 existing cards ✅)
- Unlocks: Story 002 (content cards authored against real component)

## Completion Notes

**Completed**: 2026-05-30
**Criteria**: 6/6 passing
**Deviations**:
- ADVISORY: TR-IDs use OKC-NN format (non-standard); not in tr-registry.yaml — no behavioral impact
- ADVISORY: `__double__` italic edge case silently drops in parseInlineMarkdown — hand-authored cards unaffected
- ADVISORY: Conditional @click handler pattern (`card ? toggle() : undefined`) — functionally correct, slightly obscures intent
- Post code-review fixes applied: `aria-expanded` + `aria-live="polite"` added
**Test Evidence**: `tests/unit/opening-knowledge-cards/opening-knowledge-card.test.ts` — 11/11 pass; `production/qa/evidence/s6-02-knowledge-card-evidence.md`
**Code Review**: Complete — `/code-review` run, aria-expanded + aria-live findings fixed
