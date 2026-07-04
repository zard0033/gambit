# Gambit — Design System

> **Gambit (繁中：暫無正式中文名)** is a warm, premium **single-player chess-training "dojo"** —
> a PWA where adult beginners learn chess *for real* against AI, then **graduate** to play humans
> on chess.com / lichess. The whole experience is framed as **a journey through a chess realm**:
> calm, atmospheric, low-pressure (no streaks, no timers, no leaderboards) — "elegant chess club /
> atmospheric game world," not "candy mobile game."

- **UI language:** Traditional Chinese (繁體中文).
- **Audience:** adult chess beginners, 25–50. Mature, not childish. Game-feel ≈ 7/10.
- **Platforms:** PC Chrome/Edge + iPhone Safari (PWA). Mobile-first.
- **Stack (production):** Vue 3 + Tailwind v4 (CSS-first `@theme`, tokens in `src/assets/main.css` — no `tailwind.config.ts`) + shadcn-vue (reka-ui).
- **Mentor persona:** *Neve* (original character) — mature, understated. SoT: `persona-neve.md` (bespoke illustration TBD, none exists yet).

---

## Sources

This system was built from the materials below. **No codebase or Figma file was attached** — the
two design docs + the seed mockup were the source of truth, and they are detailed and internally
consistent. If you have the repo, these are the canonical files the docs reference:

| Source | What it is | Access |
| --- | --- | --- |
| `uploads/visual-design-system.md` | Full visual design system (colors, type, nav, map, board, elevation, anti-patterns) — the SoT for "what screens look like" | provided |
| `uploads/claude-design-brief.md` | One-page seed brief (product, audience, north stars, tokens, glass spec) | provided |
| `uploads/claude-design-seed-mockup.png` | Finished 4-screen reference (Home · Learn · Game · Review) → `assets/seed-mockup.png` | provided |
| `design/gdd/game-concept-v2.md` | Game-concept GDD — chessboard/piece/annotation visual language (日本傳統色) | referenced, not provided |
| `design/ux/accessibility-requirements.md` | A11y rules — **takes precedence** over visuals (contrast, reduced-motion, forced-colors) | referenced, not provided |
| `persona-neve.md` | Mentor persona SoT — Neve, original character | provided |
| `src/assets/main.css`, `src/components/*.vue` | Production implementation (Tailwind v4 `@theme` tokens) | referenced, not provided |

**Authority order when specs conflict:** accessibility-requirements > game-concept GDD / ADR / control-manifest > visual-design-system.

> ⚠️ The **chessboard, pieces, move annotations, and eval bar are owned upstream** (game-concept GDD)
> and must NOT be restyled by this system. We only align the app-chrome accent gold to the board's
> keySquare gold so "focus / reward / key-moment" signals are consistent site-wide.

---

## Index / Manifest

Root files:
- **`README.md`** — this file (context, content + visual foundations, iconography, manifest).
- **`colors_and_type.css`** — single source of truth for color + type CSS variables (base + semantic).
- **`SKILL.md`** — Agent-Skill front-matter so this system is usable as a downloadable skill.
- **`assets/`** — logos, the seed mockup, and any copied brand imagery.
- **`fonts/`** — self-hosted webfonts (see Typography; currently CDN-linked, drop Sarasa here to match prod).
- **`preview/`** — small HTML cards that populate the Design System tab (colors, type, components…).
- **`ui_kits/app/`** — the Gambit app UI kit (4 core screens as an interactive click-thru prototype).

There is **one product** (the mobile-first app); no marketing site / docs site exists in the materials,
so there is one UI kit. **No slide template was provided**, so no `slides/` folder was created.

---

## CONTENT FUNDAMENTALS

The product speaks **Traditional Chinese (繁體中文)** throughout. Copy is **calm, warm, and
encouraging** without being cute — it treats the reader as a capable adult on a serious-but-gentle
journey.

- **Voice / person:** speaks *to* the player using **你** ("you"), warmly and directly. The mentor
  (Neve) is understated, never chirpy. No exclamation-mark spam.
- **Tone:** premium, motivating, **low-pressure**. No urgency mechanics, no "don't break your streak!"
  guilt, no competitive trash-talk. The vibe is a quiet, elegant chess club at dusk.
- **Casing / script:** Chinese has no case; Latin/numbers sit inline (e.g. `Lv.4`, `+0.6`, `12.c3`).
  Move notation and ratings use **tabular figures** so numbers don't jitter.
- **Greeting pattern:** time-aware and personal — e.g. *「晚安，Eason」* then a soft invitation
  *「今天想下一盤嗎？」* (note the gentle question, not a command).
- **Section / chapter naming:** evocative and structured — chapters are *places* in the chess realm.
  e.g. *「第一章 · 基礎規則」* ("Chapter One · Fundamentals"), lesson *「城堡與主教」* ("Castling & the Bishop").
- **Buttons / CTAs:** short verb phrases, often with a directional arrow — *「開始對局 →」*,
  *「繼續 · 第 3 課 →」*, *「關鍵一手」*, *「提示」*, *「認輸」*.
- **State copy:** plain and reassuring — turn badge reads *「輪到你」* (jade pill) or *「AI 思考中 ●●●」*
  (glass pill). Review verdicts are framed from the player's side — *「白方稍優（+0.6）」*,
  *「黑方佔優（−1.4）」* — neutral and factual, never emotive about the player's skill.
- **Emoji:** **never.** No emoji as icons, no sticker art. Icons are clean Lucide-style line vectors.
  Even ✓ / 🔒 are SVG icons, not emoji glyphs.
- **Numbers / stats:** understated. Dashboard shows quiet totals (*「戰績 1240」*, *「今日謎題 3 題」*)
  with "coming soon" placeholders kept deliberately plain (*「即將推出」*). No data-slop.

**Examples lifted from the mockup:**
`晚安，Eason` · `今天想下一盤嗎？` · `開始新對局` · `對手 Lv.4 · 自選強度與執子` ·
`繼續學習` · `第一章 · 基礎規則` · `學會棋子走法與基本規則` · `輪到你` · `AI 思考中` ·
`覆盤 · 12 / 34` · `白方稍優（+0.6）` · `最佳 Nbd2` · `關鍵一手`.

---

## VISUAL FOUNDATIONS

**Style position:** *Refined Wood Hall × Subtle Skeuomorphic Depth* (精緻木質殿堂 × 微擬物深度),
finished with a **modern glass** base. The signature idea: a **deep-jade anchor** + **saturated gold
accent** make interactive/reward elements POP off a low-saturation cream field. A real wooden
chessboard is the warm centerpiece; the app "world" (deep jade + gold + glass) frames it.

### Color
- **Three tonal zones:** (1) warm **cream** content (`#FAF6F0` page / `#FCF9F3` card), (2) **deep jade**
  anchor (`#103029` nav + immersive zones), (3) **wood** board. Every screen needs a dark anchor so
  light content has something to sit against — the system's #1 rule (avoid all-mid-tone-brown "灰撲撲").
- **Primary = deep jade 青瓷** `#1C7059` (hover `#155747`) — buttons, links, focus, progress.
- **Accent = one brand gold 山吹色** `#F8B500` — focus rings, progress, CTA gradients, map trail, nav
  indicator. **Fills/indicators only — never body text** (only ~1.6:1 on cream). Gold *text* must be
  `#8F6200` and large; text *on* gold fill is `#3A2408`.
- **Saturated color is rationed** to interaction + reward; large fields stay low-sat cream to avoid
  "cheap." Semantic: success sage `#4A7C59`, danger warm-red `#B8533A`, hint amber `#C9872E`.
- **Imagery vibe:** warm, painterly, atmospheric (Epic Seven / Wuthering Waves north stars) — gold
  filigree + slow shimmer reserved for **special moments only** (hero, level-up, chapter intro), never
  everyday UI. The wooden board reads warm and tactile.

### Type
- **Display / headings:** **BIZ UDPMincho**（明朝）+ Noto Serif TC fallback — gravitas, the "殿堂感" (hall-like dignity).
  Serif is for the heading layer only; never set body in serif.
- **Body / UI:** **Sarasa UI TC** (更紗黑體) — Regular + Bold self-hosted; default for all body, labels, buttons, dates.
- **Notation / numeric:** **Cubic 11** (11px 點陣像素字) — retro game-data feel; tabular figures for棋譜, eval, counters.
- **Lesson body:** **LXGW WenKai TC** (霞鶩文楷) — warm calligraphic feel for lesson step text and dungeon flavour copy.
- **Brand wordmark:** **Cinzel** — GAMBIT wordmark only (`app-nav.vue`).
- Scale (px): display 44 · display-sm 32 · h1 28 · h2 22 · h3 18 · body 16 (min) · body-sm 14 ·
  label 13 · caption 12 · notation 14 (tabular-nums). Body min **16px** to avoid iOS auto-zoom.
- Notation / ratings / move-counters use **tabular figures** so values don't shift.

#### Font-family usage rules（Production binding）

> Matches `src/assets/main.css` (Tailwind v4 `@theme` `--font-*` tokens + `.font-num` explicit override).

| Tailwind class | Font | Use | Never use for |
| --- | --- | --- | --- |
| `font-display` | BIZ UDPMincho | Page h1/h2, card titles, display copy, modal headings | Body text, buttons, labels, numbers |
| `font-sans` | Sarasa UI TC | All body, UI labels, buttons, descriptions, dates, any text ≤ 10 px | — (default) |
| `font-num` | Cubic 11 | 棋譜 notation; eval scores; board coordinates; game-data counters (手數/Lv./進度分數) **≥ 11 px**; single-char result badges (勝/負/和) ≥ 14 px; immersive-world labels (試煉地圖 tile number, level names on deep/dungeon bg) | Any text < 11 px (pixel grid collapses → jagged fallback; use `font-sans` instead) |
| `font-lesson` | LXGW WenKai | Lesson step quote/aside, lesson summary, dungeon success/hint flavour copy | General UI, buttons, non-lesson contexts |
| `font-brand` | Cinzel | `GAMBIT` wordmark in app-nav only | Anything else |

**Key constraint — Cubic 11 minimum size 11 px**: the font is designed on an 11 px grid. Rendering below that size causes the pixel grid to sub-sample into anti-aliased blur, losing the intended retro-data aesthetic. Use `font-sans` for any numeric display smaller than 11 px (e.g. tiny badge indicators inside 18 px circles).

**Gold text rule**: `font-num` (and any font) on cream background — gold text must be `text-gold-dark` (`#8F6200`, ~4.95:1 AA) on large copy only. `text-gold` (`#F8B500`) is fills/indicators only; it fails contrast on cream.

### Spacing & layout
- **4 / 8px rhythm**; section steps 16 / 24 / 32 / 48.
- Mobile-first; **bottom tab bar** is the primary nav (4–5 items: 首頁 / 學習 / 對局 / 我的), top header
  holds only brand + a settings gear. ≥768px may switch to a left sidebar (same tokens).
- Fixed nav/tab respect **safe areas** (`env(safe-area-inset-*)`); use `min-h-dvh`, not `100vh`.
- Touch targets ≥ **44×44px**.

### Backgrounds
- Cream flat fields for content; **deep-jade solid** for anchors (NOT photo textures — the old wood-jpg
  nav background was an anti-pattern: noisy, ate contrast). Immersive "world" zones may use deep jade
  with a subtle parchment feel. The board itself is a real wood texture image.

### Glass (the signature finish)
- On dark/jade: `background: rgba(255,255,255,.07)`, `backdrop-blur: 8–12px`,
  `border: 1px solid rgba(255,255,255,.16)`, top sheen `inset 0 1px 0 rgba(255,255,255,.22)`, soft outer
  shadow. Frosted panels, soft top-light sheen, gentle gold glow on the focused element.

### Corners, borders, cards
- **Radii:** button `0.5rem`, card `0.75rem`, large card `1rem`, pill `999px`.
- **Borders:** hairline warm lines `#E0D3BD` / subtle `#ECE1CD` / strong `#CDB999`.
- **Cards:** cream `#FCF9F3`, radius `0.75–1rem`, warm-brown soft shadow (`shadow-card`), thin warm
  border. The "Continue learning" card uses a jade left-accent rule. **No** colored-left-border-only
  AI-slop cards beyond that intentional pattern.

### Shadow / elevation
- **Warm-brown soft shadows**, never pure black (pure black looks dirty on warm tones).
  Steps: page (0) → card (`shadow-card`) → hover (`shadow-card-hover`) → popover/dialog (stronger).
  Inside deep zones, lift with `surface-deep-2` lightness rather than shadow.

### Motion
- **Restrained.** Micro-interactions 150–300ms, transitions ≤ 400ms, **transform/opacity only**
  (box-shadow animation is forbidden by a11y rules). Soft glow, depth, slow 2s gold "breathe" on the
  focused element. **No** confetti, cartoon bounce, neon flash, or screen shake. Motion shows causality,
  never decorates. Fully respect `prefers-reduced-motion` (breathe + glow go static).

### Hover / press / focus / disabled
- **Hover:** cream surfaces → `surface-hover #EFE4D2`; on deep → text brightens to `ink-on-deep` + `white/8` fill.
- **Press:** gentle `transform: scale` shrink (no box-shadow animation); jade buttons darken to `#155747`.
- **Focus-visible:** **2px gold ring** (`#F8B500`) — keyboard nav, never removed; on the hero focus
  element, a soft gold glow.
- **Disabled:** opacity 0.4–0.5, not clickable, cursor change.
- State is **never color-only** — done/locked/error also carry a shape or icon.

---

## ICONOGRAPHY

- **System:** **clean vector line icons, single family — Lucide-style.** The brief names Lucide
  explicitly (e.g. `Zap` ⚡ for the review "key move" jump). This system **links Lucide from CDN**
  (`lucide@latest`) since no in-repo icon assets were provided — a faithful match to the spec
  (consistent stroke weight, rounded line style). If the repo ships its own SVG set, drop it into
  `assets/icons/` and repoint.
- **Stroke / style:** single line family, uniform stroke weight, rounded caps/joins. No mixing fill +
  line families.
- **Emoji:** **never** used as functional icons. Even check ✓ and lock 🔒 in the learning map are SVG
  icons (`check`, `lock`), not emoji glyphs.
- **Unicode as icons:** avoided for UI controls. The one place glyphs appear is **chess pieces** — in
  production these are the **Gioco Wood SVG set** (`/pieces/*.svg`, black pieces get
  `--piece-dark-brightness:1.2`). Those SVGs were **not provided**, so the UI kit renders the board with
  Unicode chess characters (♔♕♖♗♘♙) styled to read as wood — **flagged as a substitution**; drop the real
  Gioco set + `board/wood12.jpg` in `assets/` to match production exactly.
- **Nav icons:** bottom tab uses line icons (home / graduation-cap / swords / user) — Lucide
  `home`, `graduation-cap`, `swords`, `user`.
- **The Gambit brand mark** in the mockup is a small **gold king/pawn silhouette** lockup beside the
  "Gambit" wordmark (Noto Serif TC). No standalone logo file was provided; `assets/` documents the
  lockup recipe. Replace with the official SVG when available.

---

## Caveats / substitutions (please confirm)

1. **Body font:** Sarasa UI TC (更紗黑體) **fully self-hosted** — Regular/400 + SemiBold/600 + Bold/700.
   Sarasa UI TC **has no Medium weight** by design; `font-weight: 500` (labels/UI) is intentionally
   aliased to SemiBold so labels have clear visual distinction from body (400 Regular).
2. **Chess pieces + board:** Gioco Wood SVG set + `board/wood12.jpg` not provided → board mocked with
   styled Unicode pieces + CSS wood tones. Drop the real assets in `assets/` to finalize.
3. **Brand logo / mentor art:** no logo SVG or Neve illustration exists yet → wordmark lockup
   approximated.
4. **No codebase/Figma:** built from docs + mockup. If a repo exists, re-attach via Import for
   pixel-exact component recreations.
