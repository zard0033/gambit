# ADR-0016: PWA Caching Strategy (vite-plugin-pwa, autoUpdate)

## Status

Accepted

## Date

2026-07-10

## Overview

Gambit ships as a static GitHub Pages app with no service worker today (per
`technical-preferences.md`: "PWA（Add to Home Screen／離線）尚未實作"). This ADR adds a PWA
layer via `vite-plugin-pwa` (`generateSW` strategy, Workbox under the hood) so the app can be
added to the iPhone Home Screen and used offline for the app shell (routes, board, pieces,
lessons UI). `registerType: 'autoUpdate'` is non-negotiable per the project's own guardrail: a
prompt-based update model would let the service worker lock a device onto a stale deployed
build, which is exactly the failure mode `technical-preferences.md` already warns about ("若日後
實作 PWA，務必用 autoUpdate 策略，否則 service worker 會把舊版鎖死、部署更新卡住 — 2026-06-25
就因誤以為有 PWA 而繞路兩輪"). This ADR also formalizes what is deliberately **not** precached —
Stockfish WASM (~7.3MB) and the font set (~8.6MB) — because eagerly precaching ~16MB on first
load would blow the `< 3s` mobile initial-load budget (`technical-preferences.md`) for assets
most sessions never fully touch (only one of several font weights renders on a given screen; the
engine is not needed until the player starts a game).

## Requirements

- Add-to-Home-Screen on iPhone Safari 16+ with a valid manifest (name, icons, `standalone`
  display, brand `theme_color`/`background_color` matching `index.html`'s existing
  `#103029` meta tag).
- `registerType: 'autoUpdate'` — a new deploy must take effect on next load, never requiring a
  user-facing "update available" prompt that can be dismissed indefinitely.
- Must not break the GitHub Pages sub-path deployment (`base` = `/gambit/` in CI, `/` locally,
  injected via `VITE_BASE_URL` — see ADR-0004). Manifest `start_url`/`scope` and the service
  worker's own registration path must resolve correctly under both.
- Must not silently reintroduce ADR-0004's `404.html` SPA-fallback problem, and must not
  conflict with ADR-0008's CSP (`worker-src 'self' blob:`, `script-src 'self' 'wasm-unsafe-eval'`).
- Must not precache Stockfish WASM or the font set — both are large, rarely-all-touched-in-one-
  session assets that would blow the mobile initial-load budget if force-fetched on first visit.
- Supabase auth/data requests must never be served from a cache — a cached auth response could
  show stale sign-in state or stale sync data.
- Zero new runtime dependencies beyond `vite-plugin-pwa` (already installed).

## Chosen Approach

**Plugin & registration** — `VitePWA({ registerType: 'autoUpdate', manifest: {...}, workbox: {...} })`
in `vite.config.ts`, `generateSW` strategy (the default; no custom service worker source is
needed, so `injectManifest` would be unjustified complexity). `src/main.ts` imports
`registerSW` from the virtual module `virtual:pwa-register` and calls it with
`{ immediate: true }` — this both (a) registers the service worker as soon as the app boots
rather than waiting for a `load` event, and (b) is the manual-registration pattern that lets the
plugin's `injectRegister: 'auto'` default skip injecting its own competing `<script>` registration
tag (verified in the built `dist/index.html` — no extra registration script is present; only one
`serviceWorker.register`-equivalent call site exists, inside the app's own bundle).

**Manifest** — `name`/`short_name: 'Gambit'`, the existing `og:description` copy
("跟著 Neve 學西洋棋——從基礎規則到戰術實戰"), `theme_color`/`background_color: '#103029'`
(matches `index.html`'s existing `<meta name="theme-color">`), `display: 'standalone'`, icons
`pwa-192.png` (192×192, `purpose: 'any'`) and `pwa-512.png` (512×512, `purpose: 'any'`) — both
already present in `public/`. `start_url` and `scope` are **left unset** — `vite-plugin-pwa`
defaults both to the resolved Vite `base` (`resolveBasePath(base)`), which is already correct
for both build modes (`/` locally, `/gambit/` in CI); hardcoding either would duplicate logic the
plugin already gets right and risk drifting from `vite.config.ts`'s own `base` value.

**Precache scope (app shell only)** — `workbox.globPatterns: ['**/*.{js,css,html,svg}',
'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png']`. The `js/css/html/svg` glob covers
every JS/CSS chunk, `index.html`, and all SVG assets (board pieces, silhouettes, `favicon.svg`)
— Workbox's own `generateSW` default pattern is `**/*.{js,wasm,css,html}` (confirmed in
`workbox-build`'s `GenerateSWOptions` schema), which is narrowed here to drop `wasm` (so nothing
auto-sweeps Stockfish's `.wasm` even if `globIgnores` were ever removed) and widened to add `svg`
(needed for the piece/board SVGs, not covered by the Workbox default). The three PNG icon files
listed explicitly are the small icons not part of the manifest's own icon list (`pwa-192.png` /
`pwa-512.png` are auto-added to the precache list separately via `includeManifestIcons: true`,
the plugin default — confirmed in `dist/sw.js`, both appear in the precache array without being
named in `globPatterns`).

**Explicit exclusion** — `workbox.globIgnores: ['stockfish/**', 'fonts/**']`. Font files
(`.woff2`) are not matched by the narrowed `globPatterns` regardless, but the exclusion is kept
as a defensive, documented boundary (protects against a future `globPatterns` broadening). The
Stockfish `.js` wrapper (20KB) *would* match `**/*.js` without this exclusion; `globIgnores`
removes both it and the `.wasm` (already outside `globPatterns`) from the precache manifest.
Verified against the real build output (`VITE_BASE_URL=/gambit/ npx vite build`): the generated
`dist/sw.js`'s `precacheAndRoute([...])` array contains **73 entries, 0 of which reference
`stockfish/` or `fonts/`**.

**Runtime caching for the excluded assets** — both Stockfish and fonts still need to work
offline once actually used, so each gets a `CacheFirst` runtime route instead of eager precache:

```ts
runtimeCaching: [
  {
    urlPattern: ({ url }) => /\/stockfish\//.test(url.pathname),
    handler: 'CacheFirst',
    options: { cacheName: 'stockfish-engine', expiration: { maxEntries: 4 } },
  },
  {
    urlPattern: ({ url }) => /\/fonts\//.test(url.pathname),
    handler: 'CacheFirst',
    options: { cacheName: 'fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
  },
],
```

`CacheFirst` is correct because both are immutable per-deploy: neither is content-hashed by Vite
(they are static `public/` pass-through files, not asset-pipeline outputs), so their URLs only
change if a future commit renames the file — a scenario the browser's own HTTP cache and the
`autoUpdate` service worker cycle (which reinstalls a fresh SW, and therefore a fresh set of
runtime caches keyed by the same `cacheName`s, on every deploy) already handle. `maxEntries: 4`
on `stockfish-engine` covers today's 2 files (`.js` + `.wasm`) with headroom for a future
second build variant, without unbounded growth. `maxAgeSeconds` one year on `fonts` is a
long-lived cap that still self-heals if the cache is ever evicted by the browser under storage
pressure.

**Supabase — deliberately no caching rule.** No `runtimeCaching` entry matches
`*.supabase.co` / `wss://*.supabase.co`. Requests to Supabase Auth/PostgREST/Realtime fall
outside every configured route and are handled by the browser's normal network path, exactly as
before this ADR — a cached auth or sync response could show a stale sign-in state or stale data
after another device changes it, which is unacceptable for the cross-device sync this app
already implements (ADR-0011).

**`navigateFallback: 'index.html'`** is set explicitly (it is also Workbox's `generateSW`
default, restated here for clarity) — a service-worker-controlled deep-link navigation resolves
to the precached shell client-side. This interacts with, but does not replace, ADR-0004's
`404.html` shim — see Related ADRs.

**chess-openings chunk size check** — the task instructed checking whether the 1.17MB
`chess-openings` chunk exceeds Workbox's default 2MB-per-file `maximumFileSizeToCacheInBytes`
precache cap. Measured from the real build: `dist/assets/chess-openings-*.js` is
**1,172,428 bytes (≈1.12MB)**, under the 2,097,152-byte (2MB) default. No override was needed —
`maximumFileSizeToCacheInBytes` is left at its Workbox default.

## Rationale

- **`generateSW` over `injectManifest`**: the app needs no custom service-worker logic (no
  background sync, no push notifications, no bespoke routing) — `generateSW`'s zero-maintenance
  Workbox-authored SW is the smaller, standard-library-first choice per the project's
  minimal-viable-solution ladder.
- **`autoUpdate` over `prompt`**: this is a standing project rule, not a per-ADR judgment call —
  see Overview. A `prompt` strategy trades a marginal "tell the user" UX benefit for the exact
  failure mode (locked-to-stale-version) this project has already been burned by.
- **Exclude-and-runtime-cache over "just precache everything"**: eagerly precaching Stockfish
  (~7.3MB) and all seven font files (~8.6MB) on the very first visit — before the player has
  even started a game or the app has rendered a single font weight beyond the initial paint —
  would roughly 6× the current ~2.6MB precache payload and directly threaten the `< 3s` mobile
  initial-load budget. `CacheFirst` runtime caching defers the cost to the first time each asset
  is actually requested (already how the browser's HTTP cache behaves today, absent a service
  worker), then persists it offline from that point on — no regression versus pre-PWA behavior,
  plus offline durability once warmed.
- **No Supabase runtime-caching rule**: this is the one place where "cache nothing" is the
  correct answer, not an oversight. Any cache in front of an auth/session/sync endpoint
  reintroduces the class of staleness bug the cross-device sync design (ADR-0011) exists to
  avoid.
- **Leaving `start_url`/`scope` unset**: `vite-plugin-pwa` already derives both from the
  resolved Vite `base` (verified in its compiled source, `dist/index.js`: `scope =
  options.scope || basePath`, `start_url: basePath` in `defaultManifest`). Setting them
  explicitly (e.g. to `'.'`) would be redundant configuration that could silently drift from
  `vite.config.ts`'s actual `base` value; trusting the plugin's own base-resolution is the
  smaller, more correct surface.
- **`immediate: true` on `registerSW`**: registers the service worker as soon as the module
  runs rather than waiting for the page's `load` event, which matters for a `< 3s` load budget
  — the app is already interactive by the time registration would otherwise be deferred to.

## Consequences

**Positive**: iPhone users can add Gambit to the Home Screen and use the core app shell
(board, pieces, lesson UI, routing) offline; every future deploy takes effect automatically on
next load with no user action, per the project's `autoUpdate` mandate; the ~16MB of
Stockfish+font assets never inflate the initial load, only the first actual use of each.

**Negative**: a device that has only ever loaded the app shell (never started a game, never
rendered every font weight) will still hit the network — and fail offline — for Stockfish
analysis or an unrendered font weight until each has been fetched at least once online. This is
an accepted trade-off (see Rationale) rather than a gap to close later; forcing full offline
availability on first visit is precisely the initial-load-budget risk this ADR avoids.

**Interaction with ADR-0004 (GitHub Pages SPA fallback)**: after the service worker has
successfully installed and activated, `navigateFallback: 'index.html'` means the *service
worker itself* now resolves any deep-link navigation (e.g. `/gambit/play`) to the precached
`index.html` client-side — the request never reaches GitHub Pages' server at all once the SW is
in control. ADR-0004's `404.html` → `index.html` shim still governs every navigation the service
worker does **not** yet control: the very first visit before the SW has registered, any visit
where SW registration failed or was cleared (private browsing, storage pressure eviction,
manual "clear site data"), and any browser that does not support service workers. Both paths
converge on the same SPA shell and the same client-side router, so there is no behavioral
conflict — only two different mechanisms covering two non-overlapping windows in time.

**Interaction with ADR-0008 (CSP)**: the existing `<meta>` CSP in `index.html` already allows
`script-src 'self'` (covers `sw.js`, a same-origin script) and `worker-src 'self' blob:` (covers
Stockfish's own worker, unrelated to but co-existing with the service worker — service workers
are governed by `script-src`, not `worker-src`, per the CSP spec). No CSP amendment was required;
this was verified by inspecting the built `index.html`'s CSP meta tag, unchanged by this ADR.

## Related ADRs

- [ADR-0004](adr-0004-vue-router-history-mode-and-github-pages-spa-fallback.md) — establishes the
  `404.html` → `index.html` SPA fallback this ADR's `navigateFallback` now runs alongside (see
  Consequences above for the exact division of responsibility once the service worker is active).
- [ADR-0008](adr-0008-csp-headers-and-wasm-deployment-configuration.md) — establishes the CSP
  this ADR's service worker registration and Stockfish runtime-caching route must not violate;
  confirmed compatible with no changes required.
