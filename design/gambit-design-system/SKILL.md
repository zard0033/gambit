---
name: gambit-design
description: Use this skill to generate well-branded interfaces and assets for Gambit — a warm, premium single-player chess-training "dojo" PWA (繁體中文 UI) — for production or for throwaway prototypes / mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create
static HTML files for the user to view. If working on production code, you can copy assets and read the
rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design,
ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code,
depending on the need.

## What's here
- **`README.md`** — full brand context: product, audience, content fundamentals (tone, 繁中 voice),
  visual foundations (color/type/glass/motion/elevation), iconography, and a file manifest.
- **`colors_and_type.css`** — single source of truth for color + type CSS variables (base + semantic).
  Import it and use `var(--primary)`, `var(--accent)`, `.gx-h1`, etc.
- **`fonts/`** — self-hosted Sarasa UI TC (body). Headings load Noto Serif TC via Google Fonts.
- **`preview/`** — 已於 2026-08-02 刪除（見 git 歷史），原內容：small reference cards for every token group (colors, type, spacing, components).
- **`ui_kits/app/`** — interactive 4-screen recreation of the app (Home · Learn · Game · Review) with
  reusable JSX components (`PhoneFrame`, `BottomTab`, `Chessboard`, `Button`, `Card`, glass, …).
- **`assets/`** — seed mockup + brand notes.

## Non-negotiables (from the brand)
- Deep-jade anchor (`#103029`) on every screen; one brand gold (`#F8B500`) for focus/reward only —
  **never gold as body text**. Cream content fields. Warm-brown shadows, never pure black.
- Noto Serif TC for headings (gravitas), Sarasa UI TC for body. Min body 16px. Tabular numbers for notation.
- Lucide-style line icons, single family. **Never emoji as icons.** Chess board/pieces owned upstream — don't restyle.
- Restrained motion (150–300ms, transform/opacity only), modern glass finish, respect `prefers-reduced-motion`.
- Mature, calm, low-pressure 繁體中文 copy that addresses the player as 你. No streaks/timers/leaderboards.
