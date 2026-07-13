# Navigation & Routing

> **Status**: Approved & Shipped (v0；路由表已擴充至 Phase 1/2，見 src/router/index.ts)
> **Author**: Eason + Claude
> **Last Updated**: 2026-05-27
> **Implements Pillar**: Pillar 3 (Single Player, No Pressure) — navigation is invisible scaffolding; screen transitions never interrupt the player's thinking, and an in-progress game is never lost to a careless tap
> **Priority**: v0 / Foundation
> **Depends on**: None (Foundation layer)
> **Depended on by**: Game Lifecycle, Post-Game Review, Game Export / Share, Game History (MVP), Settings (Polish), PWA Support (Polish)

## Overview

Navigation & Routing is the app shell — the Vue Router configuration and the thin layout frame that hosts every screen of the Chess Training Companion. It is not a feature the player perceives directly; it is the wiring that lets the player move between "start a game", "play a game", and "review the game I just finished" without ever wondering where they are or losing work in transit. It owns the route definition table, the route guards that protect an in-progress game from accidental navigation, the scroll/focus behavior on transition, and the handling of unknown or stale URLs (404 / deep-link to a game that doesn't exist).

This system has a deliberately small v0 surface: only the three routes the core loop demands — **Home** (start a game), **Play** (the active game), and **Post-Game Review** (analyze the game just played). Every other screen named in the concept (Game History, Settings) is reserved as a future route stub but is **not** designed here; defining them now would be speculative design against systems that don't yet exist. The single piece of genuine design complexity in v0 is the **in-game navigation guard**: leaving the Play route while a game is in progress must be intercepted and confirmed, because an abandoned game is lost value and a violated pillar. Everything else in this system is configuration, not invention.

The player experiences this system only as the absence of friction — pages that appear instantly, a back button that does the sensible thing, and a single calm confirmation the one time it matters (when they're about to walk away from a live game).

## Player Fantasy

Navigation should be invisible. The player came here to think about chess positions, not to operate software. Moving from the home screen into a game, or from a finished game into its review, should feel like turning a page in a book they were already holding — no loading ceremony, no disorientation about where they are, no decision about how to get back. The board is the center of attention; the shell around it fades.

The one moment the system steps forward is also in service of calm: if the player is mid-game and does something that would abandon it — taps the browser back button, follows a stale link, closes the tab — the app catches them with a single quiet question ("Leave this game? Your progress will be lost") rather than silently discarding twenty minutes of thinking. This is the navigation equivalent of the Pillar 3 promise: *mistakes are not punished*. An accidental tap is not a lost game. After the player confirms or cancels, the system gets out of the way again.

**Reference points:**
- **lichess** — moving between board, analysis, and home is instantaneous and unceremonious; the URL is meaningful and shareable, but the player never thinks about it.
- **A native iOS app** — back gestures and tab switches feel built-in, not bolted on; transitions respect the platform's expectations rather than reinventing them.

**Explicitly NOT this system's job:**
- No page-transition animations, splash screens, or "loading…" theatrics — transitions are instant or they show the consuming screen's own loading state (which that screen owns).
- No navigation chrome that competes with the board for attention (no persistent mega-menu, no breadcrumb trail in v0).
- No deciding *what* a screen contains — this system only decides *which* screen is shown and *whether* a transition is allowed. The content of Play, Review, etc. belongs to those systems' GDDs.
- No persistence of game state — saving/restoring an in-progress game is Game Lifecycle's job (MVP). This system only *asks* whether leaving is safe; it does not save anything.

## Detailed Design

### Core Rules

1. **Vue Router in HTML5 history mode** (`createWebHistory`), not hash mode. Clean URLs (`/play`, `/review`) for shareability and native PWA feel. GitHub Pages SPA fallback (see Edge Cases) is required because the server has no per-route handler.
2. **Single root layout (`AppShell`).** A single persistent layout component wraps `<router-view>`. v0 layout is minimal: a content area only, no persistent nav bar (the three v0 screens self-navigate via in-content buttons). A persistent nav/tab bar is reserved for MVP when Game History and Settings create the need for a multi-destination switcher.
3. **v0 route table — three routes plus catch-all** (full table in "Route Table" below). Only Home, Play, and Post-Game Review are defined as live routes in v0. Game History and Settings are declared as **reserved future routes** (commented stubs, not registered) so their intended paths are documented but no dead screen is reachable.
4. **The in-game navigation guard is the system's one real mechanism.** A `beforeRouteLeave` guard on the Play route (or a global `beforeEach` checking a `gameStore.isGameInProgress` flag) intercepts any navigation away from an active game and requires confirmation. See "In-Game Guard" below.
5. **"Active game" is owned by Game Lifecycle, read by this system.** Navigation does not decide whether a game is in progress; it reads a boolean (`isGameInProgress`) from the game store. This keeps the guard logic trivial and the source of truth single. (Bidirectional handoff: Game Lifecycle must expose this flag — see Dependencies.)
6. **Route-level lazy loading.** Each route's component is a dynamic `import()` so the initial bundle stays small (supports the < 3s mobile load budget). The shell and Home load eagerly; Play and Review load on first navigation.
7. **Scroll & focus reset on navigation.** On every successful route change, scroll the content area to top and move focus to the new screen's primary heading (`scrollBehavior` returns `{ top: 0 }`; a router `afterEach` hook focuses the route's `<h1>`/landmark). Accessibility requirement: focus must not be lost to `<body>` on SPA transitions, which would break keyboard and screen-reader users. **Scroll/focus reset fires only on a confirmed/allowed route change** — a guard *cancel* (player chooses "Stay", staying on `/play`) is not a successful route change and MUST NOT trigger scroll reset or focus move. This matters for the popstate path: even though the URL was momentarily manipulated to restore `/play` (see "Popstate handling sequence"), no route transition completed, so `scrollBehavior` does not run and the player's scroll position on the board is preserved.
8. **404 / unknown route → a calm "not found" screen with a single "Back to Home" action.** Never a blank page, never a framework error. The catch-all route (`/:pathMatch(.*)*`) renders a minimal `NotFoundView`.
9. **Deep-linking is allowed but bounded in v0.** `/` and `/play` are deep-linkable. A direct deep-link to `/review` with no game in memory is a **degraded state** (there is nothing to review) and redirects to Home — review of a *specific past game* by ID is an MVP concern (Game History owns game IDs and persistence). v0 has no review-by-id route.
10. **No route requires authentication in v0.** Auth (and therefore auth-gated route guards) is an MVP system. v0 is fully local and anonymous; every v0 route is publicly reachable.
11. **The guard's confirmation UI is owned by this system but is a generic primitive.** A single `<ConfirmDialog>` (or `window.confirm` as a v0 fallback — see Open Questions) is used; this system defines *when* it appears and *what it asks*, not a bespoke design per screen.
12. **`beforeunload` covers the non-SPA exit.** In-SPA navigation is caught by the Vue Router guard; full-page exits (tab close, browser refresh, hard URL change) are caught by a `beforeunload` listener, registered/unregistered in lockstep with `isGameInProgress`. The two guards together cover both exit channels (see Edge Cases).

### Route Table

| Path | Name | Component (lazy) | Tier | Guard | Notes |
|------|------|------------------|------|-------|-------|
| `/` | `home` | `HomeView` | v0 | none | Start-a-game screen. Eager-loaded (entry point). |
| `/play` | `play` | `PlayView` | v0 | `beforeRouteLeave` (in-game confirm) + `beforeunload` | The active game. Owns the board + Game Lifecycle UI. The only guarded route in v0. |
| `/review` | `review` | `ReviewView` | v0 | redirect-to-home if no game in memory | Post-Game Review of the just-finished game (held in store, not persisted). No game → redirect Home. |
| `/journal` | `journal` | `JournalView` | Phase 1 (差異化) | none | 棋誌全覽（Neve 記憶載體）。`fullBleed`（無 app chrome、無 tab bar）；頁內「返回」回首頁。訪客可達。進入點＝首頁 peek（story-005）。 |
| `/:pathMatch(.*)*` | `not-found` | `NotFoundView` | v0 | none | Catch-all. Renders calm 404 + "Back to Home". |
| `/history` | `history` | *(reserved)* | MVP | TBD | **Reserved — not registered in v0.** Game History list. Needs Data Sync + Game History GDD. |
| `/history/:gameId` | `game-detail` | *(reserved)* | MVP | TBD | **Reserved.** Re-watch / re-review a specific past game by ID. Deep-linkable + shareable across devices. |
| `/settings` | `settings` | *(reserved)* | Polish | TBD | **Reserved.** Settings panel. Needs Settings GDD. |

**Reserved routes are documented, not implemented.** They exist in this table to fix their intended paths (so MVP work doesn't reinvent them and so deep-link shapes are stable), but they are NOT added to the v0 router config. Adding them now would create reachable-but-empty screens — an anti-pattern this GDD explicitly avoids.

### In-Game Guard

The guard is the only behavioral logic in this system. It exists to honor Pillar 3: an accidental navigation must never silently destroy an in-progress game.

**Trigger condition:** a navigation *away from* `/play` is requested (any cause: in-app button, browser back/forward, manual URL edit, tab close, refresh) **AND** `gameStore.isGameInProgress === true`.

**Two interception channels:**

| Exit channel | Mechanism | Behavior |
|--------------|-----------|----------|
| In-SPA navigation (router) | Vue Router `beforeRouteLeave` on `PlayView` (or global `beforeEach`) | Show `<ConfirmDialog>`; resolve guard with `true` (allow) or `false` (cancel) based on the player's choice. Navigation is suspended until resolved. |
| Full-page exit (close/refresh/external) | `window.addEventListener('beforeunload', handler)` while a game is active | Set `event.returnValue` to trigger the browser's native "Leave site?" prompt. The custom message is ignored by modern browsers (they show a generic string) — this is an accepted browser constraint, not a defect. |

**Guard resolution states:**

| State | Description | Resolution |
|-------|-------------|------------|
| **GUARDED** | Game in progress; the in-SPA router guard is armed (and the independent `beforeunload` listener is attached — see note below) | Any in-SPA navigation-away request → CONFIRMING |
| **CONFIRMING** | An in-SPA navigation away from `/play` has been requested *by any source* — in-app button push **or** a `popstate` (Back/forward/swipe-back) — and the dialog is shown. For the `popstate` sub-case, the URL has already been restored to `/play` *before* this state is entered (see "Popstate handling sequence" steps 1–2); for the button-push sub-case the URL never left `/play`. In both cases the address bar reads `/play` while the dialog is open. | Player confirms → ALLOWED (navigation proceeds via `router.push(target)`) / Player cancels → GUARDED (stay on `/play`) |
| **ALLOWED** | Player confirmed leaving, OR `isGameInProgress` became false (game ended naturally) | Navigation proceeds |
| **DISARMED** | No game in progress (`isGameInProgress === false`) | In-SPA guard inactive; navigation is free. (The `beforeunload` listener is detached on the GUARDED→DISARMED transition — see note below.) |

> **`beforeunload` is NOT one of these four states — it is an independent listener.** The four states above describe only the *in-SPA* router guard's lifecycle. The full-page-exit channel (`window` `beforeunload`) is a separate `addEventListener`/`removeEventListener` pair that is **armed/disarmed in lockstep with `isGameInProgress`**, not driven by the CONFIRMING/ALLOWED transitions:
> - On **GUARDED** entry (`isGameInProgress` → true): `window.addEventListener('beforeunload', handler)`.
> - On **DISARMED** entry (`isGameInProgress` → false): `window.removeEventListener('beforeunload', handler)`.
>
> It deliberately does not move through CONFIRMING or ALLOWED, because `beforeunload` cannot show a custom async dialog — it only sets `event.returnValue` to request the browser-native prompt. Tying its arm/disarm to `isGameInProgress` (rather than to the in-SPA state machine) is what keeps the two exit channels independent and prevents a leaked listener after an in-SPA "Leave".

**Disarm-on-end is critical.** When a game ends naturally (checkmate/draw/resign, owned by Game Lifecycle), `isGameInProgress` flips to `false` and the guard DISARMS *before* the app navigates to `/review`. Otherwise the player would be asked "leave this game?" on the intended, correct transition into review — a false alarm that would erode trust in the prompt. The transition Play → Review at game end must therefore be guard-free.

**Popstate handling sequence (Back/forward button, swipe-back).** A `popstate`-triggered guard is the load-bearing case for Pillar 3 ("an accidental Back tap never loses the game"), and it must be specified precisely because the browser has *already* changed the URL by the time the guard runs. The implementation MUST follow this exact ordering, and it MUST NOT rely on Vue Router 4's own automatic URL restoration (returning `false` from a `beforeEach` guard) for the popstate path — doing both restores the URL twice (a double-push / visible URL flicker). Choose one mechanism and own it:

1. **popstate fires** → the global `beforeEach` guard observes `from='play'`, `isGameInProgress===true`, and that the navigation was triggered by a history pop (not an in-app `router.push`).
2. **Synchronously restore the URL to `/play`** using a single chosen mechanism: call **`history.pushState`** manually to re-push a `/play` entry. (Chosen over `router.go(1)` because `router.go(1)` only works if a forward entry still exists and races with the guard's own resolution; a manual `pushState` is deterministic and does not depend on forward-stack state.) Do **not** additionally return `false` from the guard for this path — returning `false` would make Vue Router *also* try to restore, producing a double restoration. The guard returns `false` (abort) for the in-app-button path but uses the manual-pushState path for popstate; the two are handled distinctly.
3. **Then `await` the confirmation dialog.** During this async window the address bar already shows `/play` again (from step 2), so the player never sees a "wrong" URL while deciding. The screen content also remains `PlayView` — no view swap occurs because the route was never allowed to change.
4. **Resolve:** on **confirm** → actively `router.push(target)` (the route the pop was heading to); on **cancel** → do nothing further (URL and view are already correctly on `/play` from step 2).

This guarantees that whether the dialog is open, confirmed, or cancelled, the displayed URL is always `/play` until the player explicitly confirms leaving — and a second Back press re-enters this same sequence (the re-pushed `/play` entry is what the second pop lands on), so it can never escape unguarded.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Game Lifecycle** | IN ← | Exposes reactive `gameStore.isGameInProgress: boolean` that the guard reads. Sets it `true` on game start, `false` on game end/resign. |
| **Game Lifecycle** | OUT → | This system calls `router.push('/review')` after Game Lifecycle signals game end (guard already disarmed). |
| **Post-Game Review** | IN ← | Reads the just-finished game from the store on `/review` mount; if absent, this system's redirect rule already sent the user Home before mount. |
| **Game Export / Share** | OUT → | No route owned by Export in v0 (it's a clipboard action invoked from Play/Review); documented here so Export's GDD knows it adds no route. |
| **Game History** (MVP) | OUT → | Will register `/history` + `/history/:gameId`; will make by-id review deep links (`/history/:gameId`) real. v0 reserves the paths only. |
| **Settings** (MVP/Polish) | OUT → | Will register `/settings`; v0 reserves the path only. |
| **PWA Support** (Polish) | IN ← | Reads `start_url` and route shapes from this table for the manifest + service-worker SPA fallback. |
| **Authentication** (MVP) | IN ← | Will add auth-gated guards on persistent routes (`/history`); v0 has none. |

## Formulas

**This system has no design-level mathematical formulas, and that is by design.** Navigation & Routing is a UI-infrastructure system whose behavior is entirely categorical (which route, allow/deny a transition, redirect or not) rather than quantitative. There are no rates, thresholds, scores, or budgets to compute. This mirrors the Chess Engine Integration GDD's stance that engine-internal evaluation math is out of scope — except here the absence is total: there is genuinely nothing to model with variables.

To avoid hand-waving, the two pieces of conditional logic in this system are stated explicitly as boolean predicates (not formulas, but documented decision rules so QA can verify them):

### Predicate 1: In-game guard activation

`shouldGuardNavigation = isGameInProgress AND (targetRoute.name ≠ currentRoute.name)`

| Term | Type | Source | Description |
|------|------|--------|-------------|
| `isGameInProgress` | bool | Game Lifecycle (`gameStore`) | True between game start and game end/resign |
| `targetRoute.name` | string | Vue Router navigation target | Where the player is trying to go |
| `currentRoute.name` | string | Vue Router current route | `'play'` when the guard is relevant |

**Evaluates to:** boolean. `true` → show confirmation; `false` → allow navigation freely.

> **No `isNaturalGameEndTransition` flag.** The natural Play→Review transition at game end is *already* guard-free without any extra signal: Game Lifecycle flips `isGameInProgress` to `false` (disarm-before-navigate) *before* the app calls `router.push('/review')`, so by the time the guard evaluates, `isGameInProgress` is already false and the predicate yields `false` (allow). An explicit `isNaturalGameEndTransition` term was considered and rejected as redundant — it would only ever be true in a window where `isGameInProgress` is already false, making the AND term unreachable. The single invariant that makes this correct is the **disarm-before-navigate ordering**, declared as a hard requirement on Game Lifecycle (see Dependencies → Bidirectional consistency notes).

### Predicate 2: Review deep-link viability

`canEnterReview = hasFinishedGameInStore`

| Term | Type | Source | Description |
|------|------|--------|-------------|
| `hasFinishedGameInStore` | bool | game store | True if a just-finished game object is present in memory |

**Evaluates to:** boolean. `true` → render `ReviewView`; `false` → `redirect('/')` (nothing to review). In v0 there is no persisted game to fall back to; that fallback (load by `gameId` from Data Sync) arrives with Game History in MVP.

## Edge Cases

**Navigation guard edge cases:**
- **If the player taps the browser Back button mid-game** (in-SPA history pop): the Vue Router `beforeRouteLeave`/`beforeEach` guard fires → confirmation dialog. On cancel, the route must be restored to `/play` *and* the history entry re-pushed so a second Back press doesn't escape unguarded. (Popstate guards must re-push the suppressed entry — a known Vue Router gotcha.)
- **If the player refreshes the page (F5 / pull-to-refresh) mid-game**: this is a full-page reload, not an SPA navigation — the router guard cannot fire. The `beforeunload` listener fires the browser-native "Leave site?" prompt. If the player proceeds, the in-memory game is gone (v0 does not persist in-progress games; persistence is an MVP Game Lifecycle concern). This loss is **documented and accepted for v0**; the `beforeunload` warning is the only mitigation v0 provides.
- **If the player closes the tab mid-game**: same as refresh — `beforeunload` native prompt only. No save in v0.
- **If `isGameInProgress` is true but the game store is actually empty** (state desync bug): the guard would wrongly prompt on a non-game. Invariant: Game Lifecycle owns this flag and must keep it consistent with actual game state. This system trusts the flag; a desync is a Game Lifecycle bug, surfaced loudly in dev, not papered over here.
- **If the guard's confirmation dialog is itself dismissed by a route change** (e.g., another navigation races in): the second navigation must also be guarded; resolve the first dialog as cancel, then evaluate the second. Never allow a dialog to leak a stale "allow".

**Deep-link / URL edge cases:**
- **If a user deep-links to `/review` with no game in memory** (bookmarked, shared, or typed): Predicate 2 fails → redirect to `/`. No error, no empty review screen. (Sharing a *specific* game is an MVP feature via `/history/:gameId`.)
- **If a user deep-links to a reserved-but-unimplemented path** (`/history`, `/settings`) in v0: it matches no registered route → catch-all `NotFoundView`. This is correct for v0 — the route legitimately does not exist yet.
- **If a user deep-links to a genuinely unknown path** (`/asdf`, `/play/123`): catch-all `NotFoundView` with "Back to Home". `/play/123` does not match `/play` (no param defined), so it 404s rather than silently loading Play.
- **If the GitHub Pages server returns its own 404 for a deep-linked route** (server has no SPA awareness): the SPA-fallback shim (a `404.html` that redirects to `index.html` preserving the path, the standard GitHub Pages SPA trick) must be in place so `createWebHistory` routes resolve client-side. Without it, every non-`/` deep link breaks on first load. **This is a hard v0 requirement, coordinated with PWA Support / deployment.**

**iOS Safari / PWA edge cases:**
- **iOS Safari swipe-back gesture mid-game**: the edge-swipe triggers a history pop, same as the Back button → router guard fires. Must be tested on real iOS — swipe-back can begin a visual transition before the guard resolves; if the OS shows a partial slide then snaps back on cancel, that is acceptable (native behavior), but the game must NOT be lost.
- **iOS PWA cold start (Add to Home Screen, launched fresh after OS purge)**: the PWA launches at `start_url` (`/`, the Home route — set in the manifest, consumed by PWA Support). A cold start never lands directly in `/play` or `/review` because no in-memory game survives a cold start in v0. If a user's home-screen icon somehow points at `/play`, the Play view mounts with no active game → it should treat "no game" as "start fresh / return Home" (coordinate exact behavior with Game Lifecycle; from routing's side, `/play` with no game is a valid route, and Game Lifecycle decides what an empty Play screen does).
- **iOS PWA standalone mode has no browser back button**: in-app navigation (the screen's own "Home"/"back" buttons) is the only in-SPA navigation path, so the router guard still covers it. There is no `beforeunload` in standalone PWA mode for the swipe-up-to-close gesture — iOS does not fire a reliable `beforeunload`/`pagehide` confirmation there, so **a deliberate app-close in standalone PWA cannot be intercepted**. This is an OS constraint; v0 documents and accepts it. (MVP's in-progress-game persistence is the real fix; the guard is only a courtesy.)
- **If the app is backgrounded and the OS purges it mid-game, then resumed via the home-screen icon**: it cold-starts at `start_url` (`/`). The previously in-progress game is gone in v0. Same accepted limitation as refresh.

**Routing-config edge cases:**
- **If two route definitions collide** (e.g., a future `/play` static and `/play/:id` dynamic): order matters in Vue Router — more-specific static paths must precede param/catch-all routes. The catch-all `/:pathMatch(.*)*` must always be last. (Lint/test guard: an automated test asserts the catch-all is the final entry.)
- **If lazy-loaded route chunk fails to load** (network drop, stale chunk hash after deploy): Vue Router's dynamic-import rejection surfaces as a navigation error. Catch it via `router.onError`; on chunk-load failure, do a hard `window.location.reload()` once (fetches fresh `index.html` + new chunk hashes). Guard against reload loops with a one-shot flag. **Caveat:** if `isGameInProgress` is true at the moment of a chunk-load reload, the silent `window.location.reload()` would discard the in-progress game without the `beforeunload` courtesy prompt (the reload is programmatic, not user-initiated). For v0 this is recorded as a **known limitation in the same class as the refresh/close loss** (no v0 persistence); a chunk-load failure mid-`/play` is rare (the Play chunk is already loaded once the player is on `/play`). If cheap, prefer to surface a confirmation before the reload when `isGameInProgress`; otherwise accept and document it alongside the refresh-loss limitation.
- **If navigation is triggered to the current route** (player taps "Home" while already Home): Vue Router resolves a same-route navigation as a (benign) `NavigationDuplicated`-style no-op; suppress its rejection so it doesn't surface as an unhandled error.

## Dependencies

### Upstream dependencies (this system depends on)

**None.** This is a Foundation-layer system with no internal dependencies. It can be designed and built before any gameplay system exists (the v0 route table can be stood up with placeholder views).

> **Soft coupling, not dependency**: the in-game guard *reads* `gameStore.isGameInProgress`, which Game Lifecycle owns. But the routing system can be fully built and tested with a mocked/stubbed flag before Game Lifecycle exists — so this is a runtime collaboration, not a build-time dependency. The Foundation classification holds.

### External dependencies (third-party libraries)

| Dependency | Version | Purpose | Replaceable? |
|------------|---------|---------|--------------|
| `vue-router` | ^4.x | Client-side routing, history mode, navigation guards, lazy routes | No — it is the system. Pinned in technical-preferences.md. |
| `vue` | ^3.x | Host framework (Composition API) | No — foundational. |
| `pinia` | ^2.x | Reads `gameStore.isGameInProgress` for the guard | Soft — could read any reactive flag, but Pinia is the project store standard. |

### Downstream dependents (systems that depend on this)

| System | What they need from us | Interface |
|--------|----------------------|-----------|
| **Game Lifecycle** | A route to live in (`/play`); the system to call `router.push('/review')` at game end | Reads `isGameInProgress` from store; we navigate on its game-end signal |
| **Post-Game Review** | A route to live in (`/review`); guarantee it never mounts without a game (we redirect first) | `/review` route + redirect-if-empty guard |
| **Game Export / Share** | Confirmation it adds no route (it's an in-screen clipboard action) | No interface — documented as route-free |
| **Game History** (MVP) | `/history` + `/history/:gameId` route registration; deep-link shapes | Reserved paths in this table; activated in MVP |
| **Settings** (MVP/Polish) | `/settings` route registration | Reserved path in this table |
| **PWA Support** (Polish) | `start_url`, route list for SPA fallback + manifest | This route table is the source of truth |
| **Authentication** (MVP) | A place to add auth guards on persistent routes | Global `beforeEach` extension point |

### Bidirectional consistency notes

- When **Game Lifecycle** GDD is authored, it MUST declare:
  - Exposing a reactive `isGameInProgress: boolean` on its store, **defaulting to `false`** (so a freshly mounted app, a cold start, or an empty `/play` never spuriously arms the guard), set `true` at game start and `false` at game end/resign — this GDD's in-game guard depends on it.
  - **Disarm-before-navigate (REQUIREMENT):** Game Lifecycle MUST set `isGameInProgress = false` *before* it triggers (or asks this system to trigger) the navigation to `/review` at game end. This ordering — not any extra `isNaturalGameEndTransition` flag — is what keeps the Play→Review end-of-game transition guard-free. If `isGameInProgress` were still `true` at the moment the guard evaluated the Play→Review push, the player would get a false "leave this game?" prompt on the correct, intended transition.
  - Owning in-progress-game **persistence** (MVP); v0 routing only warns via `beforeunload`, it does not save.
  - Deciding what an empty `/play` screen does (cold-start / direct deep-link with no active game).
- When **Post-Game Review** GDD is authored, it MUST declare that it reads the finished game from the store and may assume it is present (this system's redirect guarantees a game exists before `ReviewView` mounts).
- When **Game History** GDD is authored, it MUST claim the reserved `/history` and `/history/:gameId` paths and define the by-id deep-link / share behavior this GDD defers.
- When **PWA Support** GDD is authored, it MUST consume this route table for `start_url` and implement the GitHub Pages SPA-fallback (`404.html` redirect) that `createWebHistory` deep-linking requires.

### Soft dependencies (enhanced by but not required)

- **PWA Support** (Polish): if present, provides the offline shell and SPA fallback that make deep-linking robust. If absent in early v0 dev, deep-linking still works on a dev server (Vite handles SPA fallback automatically); only the GitHub Pages production deploy strictly needs the `404.html` shim.

## Tuning Knobs

This system has very few tunable values — it is structural, not numeric. The handful that exist are listed for completeness.

| Knob | Default | Safe Range | What breaks if changed unwisely |
|------|---------|-----------|----------------------------------|
| `confirmLeaveMessage` | `"Leave this game? Your progress will be lost."` | Short, plain sentence | Too long → truncated in native dialogs; too vague → player doesn't grasp the consequence. Must name the consequence (lost progress). |
| `historyMode` | `createWebHistory` | `createWebHistory` \| `createWebHashHistory` | Switching to hash mode breaks clean/shareable URLs and the native PWA feel, but removes the GitHub Pages SPA-fallback requirement. Documented escape hatch only if SPA fallback proves unworkable. |
| `chunkLoadReloadOnce` | `true` | `true` \| `false` | If `false`, a stale-chunk navigation error shows a broken screen instead of self-healing via reload. Keep `true`. |
| `scrollOnNavigate` | `{ top: 0 }` | `{ top: 0 }` \| preserve | Preserving scroll across unrelated screens disorients; reset is correct for this app's distinct full-screen views. |
| `eagerRoutes` | `['home']` | subset of route names | Eager-loading more routes shrinks per-navigation latency but grows the initial bundle (threatens the < 3s mobile load budget). Keep minimal. |

### Interaction notes

- **`confirmLeaveMessage` ↔ Player Fantasy "single quiet question"**: this is the only sentence the navigation system speaks to the player. It must be calm and informative, not alarming. It is the verbal embodiment of Pillar 3's "mistakes are not punished" — phrase it as a courtesy, not a warning.
- **`historyMode` ↔ deep-linking**: `createWebHistory` is what makes `/play`, `/review`, and future `/history/:gameId` real shareable URLs. The cost is the GitHub Pages SPA-fallback shim. The two move together — do not switch history mode without re-deciding the deployment fallback.
- **`eagerRoutes` ↔ Initial Load budget**: Home is eager because it's the entry point; Play and Review are lazy because deferring their (and chessground's, and Stockfish's) cost keeps first paint fast. Adding Play to eager routes would pull the chess board bundle into first load — a direct hit to the < 3s mobile budget.

### Source of truth

These values live alongside the router definition (e.g., `src/router/index.ts` and a small `src/router/config.ts`). They are system-level, not player preferences — Settings (Polish) does not expose any of them.

## Visual/Audio Requirements

**Minimal — this system owns only two thin UI primitives, and no audio.**

- **`NotFoundView`** (404 screen): a calm, centered message and a single "Back to Home" button (≥ 44×44px touch target). No illustration required in v0; plain text + button. Must pass the same accessibility bar as every screen (focusable heading, keyboard-reachable button).
- **`<ConfirmDialog>`** (in-game leave confirmation): a modal with the `confirmLeaveMessage`, a "Leave" (destructive) and a "Stay" (default/cancel) button, both ≥ 44×44px. Focus must be trapped within the dialog while open and returned to the triggering element on close (accessibility). v0 may use `window.confirm` as a stopgap (no styling, native, but accessible and zero-build-cost) — see Open Questions.
- **App shell layout**: a single content region; no nav chrome in v0. No transition animation (instant swap). The consuming screens (Home, Play, Review) own all of their own visuals and any loading states.

This system emits no sound. (Audio cues are owned by the Audio System, Polish tier, and are not gated on navigation events in any current design.)

## UI Requirements

- The shell, `NotFoundView`, and `<ConfirmDialog>` are the only DOM this system owns. Everything else inside `<router-view>` belongs to the routed screen's own GDD.
- **Accessibility (hard requirements, testable):**
  - On every route change, focus moves to the new screen's primary landmark/heading — focus is never dropped to `<body>`.
  - The leave-confirmation dialog is fully keyboard-operable. *If OQ#1 resolves to a custom `<ConfirmDialog>`*: it MUST trap focus (Tab cycles within), map Esc = "Stay"/cancel, and activate the focused button on Enter. *If OQ#1 resolves to `window.confirm`*: focus-trap, Esc, and keyboard operation are provided natively by the browser and need no implementation (the testable assertion shifts to intercepting the native dialog — see Acceptance Criteria).
  - All interactive elements (404 button, dialog buttons) are ≥ 44×44px and reachable by touch and keyboard. No hover-only affordances.
- These are validated via `/ux-review` and the Acceptance Criteria below; this GDD does not specify pixel-level visual design (that is `/ux-design`'s job in Pre-Production).

## Acceptance Criteria

### Route resolution (v0)

- **GIVEN** a fresh app load at `/`, **WHEN** the app mounts, **THEN** `HomeView` renders AND the route name is `home` (Playwright: assert visible Home content + `page.url()` ends in `/`).
- **GIVEN** the app at `/`, **WHEN** the player triggers "start a game" navigation, **THEN** the URL becomes `/play` AND `PlayView` mounts (Playwright: click start → assert `/play` + board container present).
- **GIVEN** a deep-link directly to `/play` (typed/bookmarked) on a build that includes the SPA-fallback shim, **WHEN** the page loads against a local `vite preview` (which serves the production build and can mimic the `404.html` → `index.html` rewrite), **THEN** `PlayView` resolves client-side with no blank page — this routing-layer assertion is testable in CI today (Playwright against `vite preview`, no live deploy required).
- **GIVEN** the actual GitHub Pages deployment, **WHEN** a `/play` deep-link is loaded against the live `*.github.io` URL, **THEN** it resolves client-side via the deployed `404.html` shim — **ADVISORY / Integration evidence (deployment gate)**, documented in `production/qa/evidence/`. This AC depends on Open Question #4 being resolved and can only be **closed after the first real GitHub Pages deploy** of a deep-linkable build; until then it is tracked, not passing.
- **GIVEN** a navigation to an unknown path `/totally-unknown`, **WHEN** it resolves, **THEN** `NotFoundView` renders with a visible "Back to Home" button AND the catch-all route name is `not-found`.
- **GIVEN** `NotFoundView` is shown, **WHEN** the player activates "Back to Home", **THEN** the URL becomes `/` AND `HomeView` mounts.
- **GIVEN** the router configuration, **WHEN** the route table is statically inspected (unit test on the routes array), **THEN** the catch-all `/:pathMatch(.*)*` is the LAST entry AND `/history`, `/history/:gameId`, `/settings` are NOT present as registered routes in v0.

### Review route guard

- **GIVEN** no finished game in the store, **WHEN** the player navigates to `/review`, **THEN** they are redirected to `/` AND `ReviewView` never mounts (Playwright: assert final URL `/` + Home content; unit test: redirect guard returns `'/'` when `hasFinishedGameInStore` is false).
- **GIVEN** a finished game present in the store (test fixture), **WHEN** the player navigates to `/review`, **THEN** `ReviewView` mounts AND no redirect occurs.

### In-game navigation guard (the core mechanism)

- **GIVEN** `isGameInProgress === true` on `/play`, **WHEN** the player triggers an in-app navigation to `/` , **THEN** the confirmation dialog appears AND navigation is suspended (URL still `/play`) until the player chooses (Playwright: click Home → assert dialog visible + URL unchanged).
- **GIVEN** the leave dialog is shown, **WHEN** the player chooses "Stay" (cancel), **THEN** the dialog closes AND the URL remains `/play` AND the game state is unchanged.
- **GIVEN** the leave dialog is shown, **WHEN** the player chooses "Leave", **THEN** navigation proceeds to the target route AND the `beforeunload` listener is removed (assert via spy that `removeEventListener('beforeunload', …)` was called).
- **GIVEN** `isGameInProgress === true`, **WHEN** the player presses the browser Back button, **THEN** the confirmation dialog appears AND, on "Stay", the route is restored to `/play` such that a second Back press is also guarded (Playwright: `goBack()` → dialog → Stay → `goBack()` again → dialog appears again, not an escape).
- **GIVEN** `isGameInProgress === false` (no active game), **WHEN** the player navigates away from `/play`, **THEN** NO confirmation dialog appears AND navigation is immediate (guard DISARMED).
- **GIVEN** a game ends naturally (Game Lifecycle sets `isGameInProgress = false` and signals end), **WHEN** the app navigates Play → Review, **THEN** NO leave confirmation appears (the natural end transition is not falsely guarded).
- **GIVEN** `isGameInProgress === true`, **WHEN** a `beforeunload` event fires (test stub), **THEN** the handler sets `event.returnValue` (assert the native prompt is requested); **AND GIVEN** `isGameInProgress === false`, **WHEN** `beforeunload` fires, **THEN** the handler does NOT set `returnValue` (no listener active).

### Predicate verification

- **GIVEN** the guard predicate `shouldGuardNavigation = isGameInProgress AND (target ≠ current)`, **WHEN** evaluated with `isGameInProgress=true, current='play', target='home'`, **THEN** it returns `true` (guard); **WHEN** evaluated with `isGameInProgress=false` (any target), **THEN** it returns `false` (allow); **WHEN** evaluated with `isGameInProgress=true, target===current`, **THEN** it returns `false` (same-route no-op) — table-driven unit test over these combinations. (No `isNaturalGameEndTransition` term: the natural game-end transition is covered by the disarm-before-navigate ordering, i.e. it falls under the `isGameInProgress=false` row, not a separate predicate branch.)

### Scroll & focus (accessibility)

- **GIVEN** any successful route change, **WHEN** the new view mounts, **THEN** the content scroll position is reset to top (`scrollBehavior` returns `{ top: 0 }`) AND focus is on the new screen's primary heading, NOT on `<body>` (Playwright: assert `document.activeElement` matches the route's `h1`/landmark after navigation).
- *(Applies only if OQ#1 resolves to a custom `<ConfirmDialog>`.)* **GIVEN** the leave-confirmation dialog is open, **WHEN** the user presses Tab repeatedly, **THEN** focus cycles only within the dialog (focus trap) AND **WHEN** Esc is pressed, **THEN** the dialog resolves as "Stay" (cancel).
- *(Applies only if OQ#1 resolves to `window.confirm`.)* **GIVEN** `isGameInProgress === true` on `/play`, **WHEN** the player triggers an in-app navigation away, **THEN** a native `confirm` dialog is raised — asserted via Playwright `page.on('dialog')`: the dialog `message` equals `confirmLeaveMessage`, `dialog.accept()` proceeds to the target route, and `dialog.dismiss()` keeps the URL on `/play`. (Focus-trap/Esc are not separately assertable for `window.confirm` — the browser owns them natively.)

### Lazy loading / resilience

- **GIVEN** the production build, **WHEN** the app loads at `/`, **THEN** the initial JS bundle does NOT include the Play route chunk (assert via build manifest / network panel that `PlayView`'s chunk loads only on first `/play` navigation) — protects the < 3s mobile load budget.
- **GIVEN** a lazy route chunk fails to load (test stub rejecting the dynamic import), **WHEN** the navigation is attempted, **THEN** `router.onError` triggers exactly one `window.location.reload()` (spy asserts single call; reload-loop guard prevents a second).
- **GIVEN** a navigation to the already-active route (e.g., Home → Home), **WHEN** it resolves, **THEN** no unhandled promise rejection occurs (duplicate-navigation rejection is suppressed).

### iOS / PWA (ADVISORY — real-device evidence)

- **GIVEN** an active game on real iPhone Safari 16+, **WHEN** the player performs the edge swipe-back gesture, **THEN** the leave confirmation appears AND, on cancel, the game is NOT lost — documented in `production/qa/evidence/` (Visual/Feel, ADVISORY).
- **GIVEN** the app installed as a PWA (Add to Home Screen) on iPhone, **WHEN** launched cold after the OS has purged it, **THEN** it opens at `/` (Home), not a stale `/play`/`/review` — documented in `production/qa/evidence/` (ADVISORY).

## Open Questions

### Design questions

1. **Confirmation primitive — `window.confirm` vs custom `<ConfirmDialog>` for v0.** `window.confirm` is zero-build-cost, natively accessible, and unblockable-styled; a custom dialog matches the app's calm aesthetic and is fully themeable but is more work and must implement focus-trapping correctly. **Recommendation**: ship `window.confirm` in v0 (it satisfies every Acceptance Criterion and the Player Fantasy "single quiet question"), upgrade to a styled `<ConfirmDialog>` in MVP alongside the first real visual polish pass. **Owner**: Eason + ux-designer. **Resolution**: before v0 implementation of the guard (low stakes — swappable later).

2. **Global `beforeEach` guard vs per-component `beforeRouteLeave`.** A global guard centralizes all navigation logic (easier to extend for MVP auth guards) but couples the router config to the game store. A per-component `beforeRouteLeave` on `PlayView` keeps the concern local to the only guarded screen in v0. **Recommendation**: per-component `beforeRouteLeave` for v0 (one guarded route, keep it local and simple); refactor to a global guard when MVP adds auth + history guards. **Owner**: gameplay-programmer + Eason. **Resolution**: before v0 implementation.

3. **In-progress game persistence vs `beforeunload`-only.** v0 deliberately does NOT save an in-progress game; refresh/close loses it, mitigated only by the `beforeunload` prompt. Is that acceptable for the v0 milestone, or should a minimal "save to `localStorage` on every move" land earlier than MVP? **Recommendation**: accept the v0 limitation (the `beforeunload` warning covers the common accidental case; full persistence is non-trivial and rightly an MVP Game Lifecycle feature). **Owner**: Eason + Game Lifecycle GDD author. **Resolution**: confirm during v0 scope sign-off. **Note**: this is the single most likely thing a playtester will complain about — flag for early playtest.

### Technical questions

4. **GitHub Pages SPA-fallback ownership.** `createWebHistory` deep-linking on GitHub Pages requires a `404.html` redirect shim. Does that belong to this GDD's implementation, to PWA Support, or to a deployment/devops task? **Recommendation**: implement the shim as part of v0 routing setup (it's tiny and routing-specific) but document it in PWA Support's GDD as a shared dependency. **Owner**: ui-programmer + devops. **Resolution**: before the first GitHub Pages deploy of any deep-linkable build. **Blocking**: yes for production deploy (dev server is unaffected).

5. **PWA standalone uncloseable-guard limitation.** In iOS standalone PWA mode, a deliberate app-close (swipe-up) fires no reliable `beforeunload`/`pagehide` confirmation — the guard cannot intercept it. Is documenting + accepting this sufficient for v0, given that MVP persistence is the real fix? **Recommendation**: accept and document for v0; revisit when in-progress persistence lands. **Owner**: ui-programmer + Eason. **Resolution**: confirm during v0 PWA testing on real iPhone. Not blocking v0 (PWA install is a Polish-tier concern anyway).
