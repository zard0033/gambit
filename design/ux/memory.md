# UX Spec: 棋憶 (Memory) — Dashboard / Slideshow / Replay

> **Status**: In Review
> **Author**: Eason + Claude (tech-manager pass)
> **Last Updated**: 2026-06-19
> **Journey Phase(s)**: Post-game reflection (after a completed game; or revisited from 棋誌)
> **Template**: UX Spec
> **GDD**: `design/gdd/memory.md` — this spec resolves the GDD's "Deferred to a UX spec / frontend pass (fix #5)" block: EC-5, EC-12, EC-13, EC-14, EC-15, AC-17, Rule 1, OQ-R1.
> **Story**: `production/epics/memory/story-006-ux-a11y-spec.md` (gates story-007 dashboard + story-008 slideshow)
> **Conformance, not invention**: every rule here conforms 棋憶 to the existing house standard —
> `design/ux/accessibility-requirements.md` (WCAG 2.1 AA) + `design/ux/interaction-patterns.md` (P-01…P-21) +
> `design/gambit-design-system/` (tokens, gold = focus/reward only) + `persona-neve.md` (回顧態 + 視覺嗓音).

---

## Purpose & Player Need

The player just finished a game (win or loss) and wants a **calm, legible memory of it** — not a
40-move report card. 棋憶 is the post-game surface: it opens on a quiet dashboard (Neve's voice +
the shape of the game + a short list of moments), and lets the curious drill into a re-played
moment or the full move-by-move board, without ever forcing them to.

This spec exists to make that calm reflection **conformant and unambiguous** for the engineers
building stories 007/008/009: which control goes where, how the two "drill-in" doors are told
apart before the tap, how every state survives color-blindness / reduced-motion / keyboard-only,
and where "back" lands. Without it, a11y gets retrofitted (always worse) and the two doors get
built as look-alike silos.

---

## Player Context on Arrival

- **Emotional state**: post-game — could be deflated (loss), satisfied (win), or neutral. The
  design assumes **fragile-calm**: never celebratory at the player, never a verdict. Quiet first,
  detail on request.
- **Two arrival contexts** (this drives back-nav, Rule 1):
  1. **From Game Over** — the game just ended; 棋憶 *replaces* today's direct-to-`ReviewView` entry.
     The player came forward from playing.
  2. **From 棋誌 (JournalView)** — the player tapped a past game's journal entry; they are revisiting,
     possibly days later, mid-browse.
- Arrival is **voluntary** (they chose "Review" / tapped an entry), never a forced interstitial.
- Analysis may still be running (#7 not COMPLETE) on a fresh Game-Over entry → progressive render
  (EC-3); a 棋誌 revisit of an old game whose `analysisResults` were dropped re-runs #7 first.

---

## Navigation Position

```
root
 ├─ Game Over (modal)  ──"Review"──▶  棋憶 Dashboard  (replaces direct ReviewView entry)
 └─ 棋誌 / JournalView  ──tap entry──▶  棋憶 Dashboard  (deep-link: gameId [+ ply])

棋憶 internal (shallow stack, dashboard is the root):
   Dashboard ──tap eval view──▶ Replay         (pops back to Dashboard)
   Dashboard ──tap moment card─▶ Slideshow      (pops back to Dashboard)
   Slideshow ──"在棋盤上逐手看"──▶ Replay (at that ply)   (pops back to Dashboard)
```

棋憶 is **context-dependent**, reached from exactly two places (Game Over, 棋誌). Its three views
are a **shallow stack**: Dashboard is the root; Slideshow and Replay are pushed over it and pop
back to it — including via the OS/browser back gesture (Rule 1 / GDD Rule 2).

---

## Entry & Exit Points

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Game Over modal | "Review" button | `gameId` of the just-finished game; `analysisResults` may be ANALYZING or COMPLETE |
| 棋誌 (JournalView) | tap a journal entry | `gameId` (+ optional `ply` from the entry's `gameId+ply` handle); results may be dropped → re-analyze |
| Slideshow / Replay | OS/browser back, or in-view "back" | returns up the shallow stack to Dashboard |

| Exit Destination | Trigger | Notes |
|---|---|---|
| **Back to entry origin** (Game Over *or* 棋誌) | back from **Dashboard** | **Rule 1: returns to wherever the user came from**, NOT a fixed destination. Implemented by remembering the entry route, not by `router.push('/journal')`. |
| Dashboard | back from **Slideshow** or **Replay** | pops one level of the shallow stack (incl. OS/browser back) |
| Dashboard | Slideshow advance past last / before first moment | EC-15: a **visible "回棋憶" cue**, never a silent jump |
| New Game / Home | via global nav | normal app navigation; no 棋憶-specific guard (review is safely abandonable — P-04 does NOT apply here) |

**Back-nav implementation rule (testable):** the Dashboard records its **entry origin** (`'gameover' | 'journal'`)
on mount. "Back" from the Dashboard resolves to that origin. The two pushed views (`Slideshow`,
`Replay`) always pop to the Dashboard. Browser/OS back must follow the same stack (no view becomes
unreachable or double-pops to the wrong origin).

---

## Layout Specification

### Information Hierarchy

**Dashboard** (vertical order is GDD Rule 3 定版 — do not reorder):

1. **Neve line** (most important — the opening voice; 深青卡 + 頭像 + 文楷)
2. **Shape-of-game eval view** (the whole arc at a glance; → Replay)
3. **Moment list** (0–5 chronological cards; each → Slideshow) — or the **zero-state line** (EC-1)

No verdict/score/"weakest" element sits above or among these (AC-1 asserts its **absence**).

**Slideshow**: board (re-played moment) > move comparison + Neve explanation (the card) > dot band > nav.
**Replay**: board (PgnViewer) + eval cursor + move list + prev/next — the dense, opt-in surface.

### Layout Zones

```
DASHBOARD (single scroll column, mobile-first)
┌─────────────────────────────────┐
│ [zone A]  Neve card             │   深青卡 (--surface-deep), 頭像 + font-lesson line
├─────────────────────────────────┤
│ [zone B]  Shape-of-game chart   │   self-drawn SVG, drift-guarded <button>
├─────────────────────────────────┤
│ [zone C]  Moment list / 零態     │   0–5 cards, OR EmptyMemory line
└─────────────────────────────────┘
```

### Component Inventory

| Zone | Component | Type | Interactive | Pattern |
|---|---|---|---|---|
| A | `NeveCard` | 深青卡 + avatar + one 文楷 line | No (text only; no number bar / no link) | new — Neve visual-voice container (persona-neve §視覺嗓音) |
| B | `EvalShapeChart` | self-drawn SVG line chart, **wrapped in one `<button>`** | Yes → Replay | **new: Drift-Guarded Chart Button** (add to library) |
| B | curve dots | SVG `<circle>` per moment, same color as its card | **No** (decorative, `pointer-events:none`, redundant color cue) | EC-14 |
| C | `MomentList` → `MomentCard`×N | list of `<button>` cards | Yes → Slideshow | **new: Moment Card** (add to library) |
| C | `EmptyMemory` | calm single line (zero-state) | No | EC-1 |
| — | `aria-live` polite region | visually-hidden, **outside** any board subtree | No | P-15 |

### ASCII Wireframe

```
DASHBOARD                          SLIDESHOW                        REPLAY
┌───────────────────────────┐      ┌──────────────────────────┐    ┌──────────────────────────┐
│ ◐ NEVE                     │      │ ‹            回棋憶  ✕ ›  │    │ ‹ 回棋憶                  │
│ 你最近三盤的殘局，比之前   │      │ ┌──────────────────────┐ │    │ ┌──────────────────────┐ │
│ 穩了一些——我們慢慢練。     │      │ │                      │ │    │ │   [PgnViewer board]  │ │
│  (font-lesson, 深青卡)     │      │ │   [chessground:      │ │    │ │   Wood12 + Gioco     │ │
├───────────────────────────┤      │ │    moment re-play]   │ │    │ │                      │ │
│ 這盤的走勢                 │      │ │                      │ │    │ └──────────────────────┘ │
│ W┤      ╭─╮                │◀tap  │ └──────────────────────┘ │    │ eval ▏gold cursor at ply │
│  │─╮  ╭─╯ ╰╮   ● ●        │ →    │ ▲ 漏掉一個主教            │    │ ┌─ move list ───────────┐│
│ B┤ ╰──╯    ╰────╮        │repl. │ 你走了 Bg5  （灰）        │    │ │ 12. … current ▶ (gold)││
│  └────────────────────────│      │ 更好的是 Bxf7+（金 8F6200）│    │ │ 13. Re1  ▎anchor accent││
│ (dots = color cue only)   │      │ ┌ Neve 文楷說明 ┐        │    │ │  ⊘ cpLoss chips        ││
├───────────────────────────┤      │ └──────────────┘        │    │ └────────────────────────┘│
│ ▲ 漏掉一個主教      −2.9   │tap   │  ● ○ ○   (dot band)      │    │ ‹ prev      next ›        │
│ ★ 你穩住了自己      +1.4   │ →    │ 在棋盤上逐手看 →(replay) │    └──────────────────────────┘
│ ◐ 被他推著走的一段  −0.7   │slide │ ‹ 上一個      下一個 ›    │
└───────────────────────────┘      └──────────────────────────┘
   ▲ triangle/danger  ★ star/success  ◐ circle-with-line/muted   ◆ signpost/turning-point (anchor-in-loss, see OQ-R1)
```

---

## States & Variants

| State / Variant | Trigger | What Changes |
|---|---|---|
| **Default** | COMPLETE, ≥1 moment | Neve line + chart + 1–5 moment cards |
| **Zero-state** (EC-1) | F1 returns 0 | zone C = `EmptyMemory` single calm line (NOT a 1-row list); chart + Neve + replay stay mounted/tappable |
| **One moment** (EC-2) | exactly 1 moment | Slideshow dot band **hidden** (a lone dot reads as "loading"); prev/next both return to Dashboard |
| **Progressive** (EC-3) | entered before #7 COMPLETE | zone C shows a quiet "still refining…" cue; **selection (F1) runs only at COMPLETE** so no card ever appears then vanishes; chart fills in as positions deepen |
| **Preview-depth** (EC-4) | anchor fell back to preview pair (#7 Rule 30) | its card carries #7's "preliminary" treatment; **never dim below WCAG 1.4.3 (4.5:1)** |
| **Guest / first game** (EC-6) | no cross-game history | Neve card = first/few-games line (F4 Step 2); per-game moments still work |
| **Cold revisit** | 棋誌 entry, `analysisResults` dropped | #7 re-analysis runs first (progressive), then Dashboard fills; **0 analysis if results already present** (AC-14) |

---

## Interaction Map

Input methods (from technical-preferences §Input & Platform): **Mouse (fine) + Touch (coarse)**;
**no gamepad**; full keyboard required (WCAG AA). No hover-only interactions (mobile has no hover).

### The two doors (EC-13) — distinct affordances, signaled *before* the tap

| Door | Control | Destination | Pre-tap affordance (how the player knows where it goes) | Label / cue |
|---|---|---|---|---|
| **Door 1** | eval shape chart (zone B) | **Replay** (dense board) | a chart with an explicit **inline label** "這盤的走勢" + a corner glyph (board/grid icon) + caption "逐手覆盤"; whole chart is one pressable surface with a button hover/active state | "逐手覆盤" |
| **Door 2** | a moment card (zone C) | **Slideshow** (one moment, animated) | a list **card** with a leading kind-icon + plain name + a trailing chevron `›` and caption "看這一手"; card press/active state | "看這一手" |

The two doors **must not look alike**: Door 1 is a full-width *chart panel* with a board glyph;
Door 2 is a *list row card* with a chevron. Caption text ("逐手覆盤" vs "看這一手") is the
non-visual (screen-reader / low-vision) channel. **No silos**: the Slideshow card carries a
cross-link "在棋盤上逐手看" → Replay at that moment's ply (Door 2 → Door 1 bridge).

### Drift-guard (EC-12) — the chart tap is deliberate, not a scroll artifact

The eval chart lives in the scrollable Dashboard column. Discriminator on the chart `<button>`:

- On `pointerdown`, record `(x, y)`.
- On `pointerup`, if total pointer travel **≤ DRIFT_THRESHOLD (10px)** AND no scroll occurred
  between down/up → **tap** (open Replay). Otherwise → **scroll** (do nothing).
- `10px` = OS touch-slop tolerance, deliberately looser than the board's 5px tap discriminator
  (P-19) because this control sits in a scroll container; the board does not.
- The chart is a real keyboard-focusable `<button>` (Enter/Space activate — drift-guard is a
  pointer-only concern; keyboard always opens Replay).
- **Curve dots are NOT separate tap targets** — `pointer-events:none`; tapping a dot opens the
  *same* Replay as tapping anywhere on the chart (AC-7).

### Per-view interaction + keyboard map (AC-17 — full keyboard parity)

**Dashboard**

| Action | Pointer | Keyboard | Outcome |
|---|---|---|---|
| Open Replay | tap chart (drift-guarded) | Tab to chart button → Enter/Space | → Replay at anchor ply |
| Open a moment | tap a moment card | Tab to card → Enter/Space | → Slideshow at that moment |
| Back to origin | back gesture / global nav | browser back | → Game Over or 棋誌 (Rule 1) |

Tab order = visual order: chart button → moment card 1 → … → moment card N. The Neve card is
**not** in the tab order (text only, no link). Curve dots are not tab stops (non-interactive).

**Slideshow**

| Action | Pointer | Keyboard | Outcome |
|---|---|---|---|
| Next / prev moment | chevrons, or swipe left/right on board | `ArrowRight` / `ArrowLeft` | move between moments; past-last/before-first → Dashboard with cue (EC-15) |
| Skip animation to end-state | single tap on board | `Enter` / `Space` (when focus on board region) | collapse in-flight timeline to final frame (idempotent) |
| Replay this moment's animation | "重播這一手" button | Tab → Enter/Space | re-runs choreography from the start |
| Cross-link to Replay | "在棋盤上逐手看" link | Tab → Enter/Space | → Replay at this moment's ply (EC-13) |
| Back to Dashboard | "回棋憶" / ✕ | `Escape`, or browser back | → Dashboard |

`Escape` = back to Dashboard (consistent with the house "Escape cancels/exits" convention).
Tab order: prev ‹ → next › → 重播這一手 → 在棋盤上逐手看 → 回棋憶. Swipe is an **additive**
convenience, never the only way (keyboard + chevrons are complete equivalents).

**Replay** — reuses the shipped PgnViewer + board keyboard model (P-20 roving tabindex, ADR-0009).
Prev/next are real buttons (Tab + Enter/Space, or board Arrow nav). `Escape` / back → Dashboard.
No new keyboard model invented here — it inherits the game-replay surface.

### Touch-target audit (≥44×44px, P-01)

| Element | Hit area | Note |
|---|---|---|
| Eval chart button | full chart panel (≫44px) | the whole panel is the target |
| Moment card | full-width row, **min-height 44px** | enforce `min-h-[44px]`; visual may be taller |
| Slideshow chevrons (‹ ›) | **44×44px** | pad icon to hit area |
| 重播這一手 / 在棋盤上逐手看 / 回棋憶 / ✕ | **44×44px** | pad to minimum; 8px min spacing between adjacent (P-01) |
| Dot-band dots | **non-interactive** (display only) | exempt — dots are a position indicator, not buttons (resolves AC-17 "any interactive dot has ≥44px hit area, OR dots are non-interactive" → we choose non-interactive) |
| Curve dots on chart | **non-interactive** | exempt (same rule) |

---

## Events Fired

| Player Action | Event / state change | Payload |
|---|---|---|
| Dashboard mounts at COMPLETE | `useMemoryStore.recordGame(summary)` **once** (write-once guard) | `MemoryGameSummary` (F4-schema) — persisted via Data Sync #11 → `memory_summaries` |
| Open Replay (chart) | route push within shallow stack | `{ ply: anchorPly }` |
| Open a moment (card) | route push within shallow stack | `{ momentIndex }` |
| Cross-link Slideshow→Replay | route push | `{ ply: moment.ply }` |
| Back from Dashboard | route back to recorded origin | — |

No analytics events in v1 (calm, no telemetry surface). The **only persistent write** is
`recordGame` — flagged for the architecture/data-sync owner; it is idempotent per `gameId`
(`UNIQUE(user_id, game_id)`), so re-entering 棋憶 for the same game does not duplicate.

---

## Transitions & Animations

All animation = `transform` / `opacity` only (no box-shadow/width/height animation); 150–300ms;
respect `prefers-reduced-motion` (house rule + accessibility-requirements §4).

| Transition | Motion | Reduced-motion |
|---|---|---|
| Dashboard enter | opacity crossfade (no slide) | instant |
| Push to Slideshow / Replay | content crossfade | instant |
| Slideshow moment re-play | the F5 choreography (see below) | **static end-state** (EC-5) |
| Chart "still refining…" → filled | opacity | instant |

### Reduced-motion static end-states (EC-5) — the both-halves rule

Under `prefers-reduced-motion: reduce`, the Slideshow shows **no motion**, but **no information is
lost** — the static board end-state must agree with the comparison text:

- **Mistake** (has a better move): board shows **both halves simultaneously** — the played-to
  square highlighted (muted/`--anno-played` tone) **and** the better-to square highlighted
  (gold/`--anno-key`), at the same time. (Not only the correction — that would contradict the
  "你走了 X │ 更好的是 Y" text.)
- **Good move** (no better move): board shows the **played move → provoked reply** as a static
  end position (your piece on its square + the opponent reply that your move forced, both placed).
- **Replay**: teleports between plies (no slide), per accessibility-requirements §4.

Testable: with `reduce` set, assert **both** the played-to and better-to squares carry the
highlight class **at the same time**, and **no** animation/transition class is present (AC-9).

### Animation knobs (motion path, `src/config/memory-config.ts`, v9 demo-tuned)

first-move pre-pause 650ms · move duration 380ms · read pauses 700/520ms. A single tap/key skips
the in-flight animation to its end-state (GDD Rule 16). OQ-2 (is the pacing calm enough?) = manual
sit-with-it sign-off; not blocked by this spec.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|---|---|---|---|
| `analysisResults[]`, `cpLoss[]`, `biggestSwingCursor` | Post-Game Review #7 (review store) | Read | 棋憶 re-runs no analysis; derives `E_white[i]` itself (F2) |
| selected moments | `selectMoments()` (story-002) | Read (pure) | runs only at COMPLETE |
| `E_white[]` series | `evalWhiteSeries()` (story-003) | Read (pure) | feeds chart |
| Neve line | `useMemoryStore.neveLine()` → `renderNeveLine` (story-004/005) | Read | text only |
| per-moment explanation | `renderMoment` (story-005) | Read | 白話, non-SAN |
| `MemoryGameSummary` | `useMemoryStore.recordGame` → Data Sync #11 | **Write** (once/game) | the only persistent write; `memory_summaries` (story-001/011) |
| `gameId` (+ `ply`) deep-link | #21 journal handle | Read | bidirectional (story-010) |
| board FEN/arrows, opening name, `bookExitPly` | chessground / #3 | Read | renderers |

UX defines what the views need; data delivery is ADR-0014's concern. Flagged for architecture:
`recordGame` is the lone state write and must be idempotent per `gameId`.

---

## Accessibility (conformance to `design/ux/accessibility-requirements.md` — WCAG 2.1 AA)

### Color-blind channel (EC-14) — every kind distinguishable without color

Each moment kind carries a **distinct icon shape** (the primary, color-independent channel) AND
the comparison's **leading words**. Color is a redundant reinforcement, never the sole cue.

| Internal kind | Icon shape | Color token | Plain name (examples) | Comparison leading words |
|---|---|---|---|---|
| **tactical** | ▲ warning triangle | `--danger` (#B8533A) | 「漏掉一個主教」 | 你走了 … │ 更好的是 … |
| **bright / pivotal** (favorable) | ★ star | `--success` (#4A7C59) | 「你穩住了自己」 | 你走了 … · 這手很好 |
| **plain swing** | ◐ circle-with-line | `--ink-muted` (#7A5C44) | 「被他推著走的一段」 | 你走了 … │ 先走 … 會穩一些 |
| **anchor-in-loss** (OQ-R1) | ◆ signpost / turning-point | `--ink` neutral + gold **accent bar** (indicator, not fill) | 「這盤的轉折」 | 你走了 … │ 更好的是 … |

The chart's **curve dots** repeat the card color as a redundant locator only; the **card list** is
the primary shape-bearing surface (a color-blind user reads icon + words on the card, never needs
the dot color). Forced-colors mode: icons use `CanvasText`; the gold accent bar uses `Highlight`
(per accessibility-requirements §6).

### Move comparison color tokens (Rule 15) — resolves the "gold as body text" tension

GDD Rule 15 says the better move is "gold". The design system forbids gold as body text **except**
`--accent-text` (#8F6200) for **large/emphasis** text. Ruling: the move comparison is prominent
emphasis text, so:

- played move → `--ink-muted` (#7A5C44), weight 400, leading word "你走了"
- better move → **`--accent-text` (#8F6200)**, weight 600, leading word "更好的是" — **not** the
  reward fill `--accent` (#F8B500), which stays a fill/indicator only.
- good move → `--success-dark` (#3A6447), leading word/suffix "· 這手很好".

Both halves at the **same `font-size`** (AC-10); role differentiated by **color + weight + leading
word** — three channels, color never alone.

### Keyboard (AC-17)

Full parity per the Interaction Map above. Every Dashboard + Slideshow action reachable and
activatable by keyboard alone; the eval chart and moment cards are **real `<button>`s** (not bare
`div`s with click handlers). Replay inherits the board roving-tabindex model (P-20). Visible focus
ring = `--focus-ring` (2px gold), never removed (≥3:1, SC 2.4.11).

### Screen reader

- One `aria-live="polite"` region, **outside** any board subtree (P-15), announces: moment change
  ("第 2 個重點，共 3 個"), EC-15 return ("回到棋憶"), and "still refining…" → ready.
- Chart button `aria-label`: "這盤的走勢，逐手覆盤" (carries the destination — the two-door cue for
  AT users). Moment card `aria-label`: "{plain name}，{played 白話}，看這一手".
- Dot band: `aria-hidden="true"` (decorative); the live region carries position instead.
- Icons are decorative within a labeled button → `aria-hidden="true"`; the label carries meaning.

### Contrast

All text ≥ 4.5:1 (body) / ≥ 3:1 (large + non-text). Preview-depth treatment (EC-4) never drops
below 4.5:1. Tokens chosen above all pass on cream: `--danger` #B8533A (5.0:1), `--success`
#4A7C59 (4.7:1 large / paired with icon), `--ink-muted` #7A5C44 (5.6:1), `--accent-text` #8F6200
(4.95:1, large only).

---

## Localization Considerations

- All copy is Traditional Chinese (the product's only locale in v0); no translation expansion risk.
- **Chess vocabulary lock**: 后 / 城堡 / 騎士 / 主教 / 國王 / 兵 (never 象棋 車/馬/象) in every plain
  name and comparison (CLAUDE.md hard rule).
- Plain-language moves, **never SAN** ("把主教移到 g5", not "Bg5") — persona-neve 回顧態 rule.
- **No CJK italic** anywhere (假斜 distorts glyphs); emphasize with weight/color/border.
- Numbers (swing values, ply counts) use `font-num` (Cubic 11, tabular) — data only, never body.

---

## Acceptance Criteria (this spec is "done" when each fix-#5 row resolves to one testable rule)

- [ ] **EC-13 two doors**: the eval chart (→ Replay, "逐手覆盤") and a moment card (→ Slideshow,
      "看這一手") have **visually distinct** affordances (chart panel + board glyph vs list card +
      chevron) and distinct captions, signaling destination **before** tap; the Slideshow card
      carries a "在棋盤上逐手看" cross-link to Replay at that ply (no silo). — verifiable by DOM
      (distinct components, distinct caption text, cross-link present).
- [ ] **EC-12 drift-guard**: chart tap fires only when pointer travel ≤ **10px** and no scroll
      between down/up; the chart is a real `<button>`; curve dots are `pointer-events:none` and not
      separate handlers. — verifiable (scroll-over-chart → no nav; tap → nav; dot tap → same nav).
- [ ] **EC-14 color-blind**: each kind = distinct icon shape (▲ / ★ / ◐ / ◆) + leading words; dots
      are redundant color only. — verifiable (icon element present per kind; meaning survives
      grayscale).
- [ ] **EC-5 reduced-motion**: mistake static end-state highlights **both** played-to + better-to
      simultaneously; good move shows played→provoked-reply static; replay teleports. — verifiable
      (both highlight classes present at once, no animation class).
- [ ] **AC-17 keyboard + targets**: every Dashboard/Slideshow action keyboard-reachable +
      activatable; chart + cards are real buttons; interactive controls ≥44px; dots non-interactive.
      — verifiable (Tab traversal hits all; computed hit area ≥44px; dots have no handler).
- [ ] **Rule 1 back-nav**: back from Dashboard returns to the **recorded entry origin** (Game Over
      or 棋誌), not a fixed route; Slideshow/Replay pop to Dashboard (incl. browser/OS back). —
      verifiable (enter from each origin, back lands on it).
- [ ] **OQ-R1 decision**: the anchor in a loss gets a **neutral "turning point"** treatment (◆
      signpost icon + ink + gold accent **bar**), NOT the celebratory star/success hue. (See Open
      Questions for rationale; recommended ruling, open to Eason override.)

---

## Open Questions

### OQ-R1 — ACCEPTED (Eason, 2026-06-20): anchor-in-a-loss = neutral turning point

The GDD flags whether the anchor (the player's costly turning point in a loss) should share the
**star/success** hue with a genuine bright recovery (Rule 12). **Ruling: no.**

- **The anchor flag does not by itself confer the celebratory hue.** A moment renders in the hue of
  its *underlying selected kind*: anchor+tactical → ▲ danger; anchor+plain → ◐ muted; an anchor that
  is genuinely a favorable bright move (merged with the bright source) → ★ success.
- **A bare anchor that is a swing *against* the player** (cp-driven, concept = none, gate-exempt) →
  a **neutral "turning point"**: ◆ signpost icon + `--ink` neutral text, marked as "the moment" by a
  **gold accent bar** (gold as *indicator*, a sanctioned focus/reward use — not body text, not a
  star). It says "this is where it turned," not "well done."
- **Rationale**: a costly turning point wearing the celebratory star contradicts 回顧態 (mistakes
  stated neutrally, good moves not gushed) and would read as praising the player's worst moment.
  The star/success stays reserved for genuinely favorable play.
- Testable: a fixture loss whose `biggestSwingCursor` is a swing-against-player renders the ◆/neutral
  treatment and **no** `star`/`success` class.

> **Decided (Eason, 2026-06-20)**: neutral turning point — shipped as-is. (Had the call gone the other
> way, 008's MomentCard would drop the ◆ branch and the anchor would keep the star.)

### Carried (not blocking this spec)

- **OQ-2** (animation pacing 650/380/700/520ms): manual sit-with-it sign-off in story-008 evidence.
- **Player journey map**: no `design/player-journey.md` exists; this spec inferred player context
  from the GDD Player Fantasy. Low risk (single-locale, well-specified GDD).

### New patterns to add to `interaction-patterns.md` (flagged, not auto-added)

- **Drift-Guarded Chart Button** (10px touch-slop tap-vs-scroll in a scroll container) — generalizes
  P-19's tap discriminator for scroll-embedded chart targets.
- **Moment Card** (icon-shape + plain name + chevron affordance, color-blind-safe list row).
- **Dot Band** (non-interactive position indicator; hidden at count 1).

These are referenced by name in stories 007/008; formalize into the library when those land.
