# ADR-0010: Game Export Tier-1/2/3 Delivery and Synchronous User-Gesture Clipboard Contract

## Status
Superseded

> **2026-08-02**：composable 層（`useGameExport` 及其狀態機、`tests/unit/game-export/tier-delivery.test.ts`）
> 已依 positioning-v2 D7 移除。`assembler.ts` 的 `buildPgn` 仍在服役（`data-sync.ts` 寫雲端 PGN、
> `MemoryView.vue` 消費），不受影響。本 ADR 保留為歷史記錄，不再是實作規則來源。

> **Spike complete (2026-05-28)**: `scripts/spike-adr0010-export-gesture-audit.mjs` — desktop delivery pattern verified (all 4 scenarios pass). iPhone device session deferred to before Sprint 3; architecture is correct by construction (TypeScript-enforced sync contract). See Validation Criteria results below.

## Date
2026-05-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web APIs (Clipboard API + Web Share API + DOM `<textarea>`) — Web App, no traditional game engine |
| **Domain** | Browser API Integration / GameExport |
| **Knowledge Risk** | MEDIUM — iOS Safari 16.0–16.3 user-activation window for `clipboard.writeText()` and Web Share API are documented behaviours but the *exact* failure mode of a violation (silent no-op vs `NotAllowedError`) varies across point releases. `navigator.canShare({ text })` returning `false` for text-only shares is observed on some Android platforms (training-data uncertainty for current iOS). Two device spikes resolve both unknowns. |
| **References Consulted** | `design/gdd/game-export-share.md` (all sections, especially Core Rules 8–10, States and Transitions, Edge Cases — clipboard/delivery); `docs/architecture/architecture.md` GameExport Module Ownership (Invariants — note the previously under-specified sync-gesture contract flagged in `architecture-review-2026-05-28.md` §B1); `docs/architecture/adr-0005-pinia-store-boundaries-and-completed-game-transport.md` (CompletedGame transport); `docs/architecture/adr-0008-csp-headers-and-wasm-deployment-configuration.md` (CSP compatibility) |
| **Post-Cutoff APIs Used** | None — Clipboard API (`navigator.clipboard.writeText`), Web Share API (`navigator.share`, `navigator.canShare`), and `<textarea>.select()` are all pre-cutoff stable APIs. iOS Safari behaviour at the 16.0–16.3 point releases is the verification subject. |
| **Verification Required** | (1) On real iPhone Safari 16+: assemble payload synchronously inside a tap handler → call `clipboard.writeText` immediately → confirm clipboard contains the payload after the gesture. (2) On real iPhone Safari 16+: confirm `navigator.canShare({ text: "..." })` returns `true` for a typical 2 KB payload (so Tier 1 is actually reachable on iOS). |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0005 (Pinia store boundaries — GameExport reads `gameStore.completedGame`, which must be assembled and frozen by GameLifecycle before the export button is reachable). ADR-0008 (CSP — must permit Clipboard API and Web Share API; both are platform APIs not affected by `script-src`/`connect-src` directives, but verified compatible). |
| **Enables** | Game History MVP — GameExport's pure synchronous assembler signature `assembleExportPayload(game, config): string` is the seam Game History will reuse to export past games |
| **Blocks** | GameExport implementation stories cannot begin until this ADR is Accepted. Specifically blocks: PGN serialization story, prompt-template assembly story, Tier-1/2/3 delivery state machine story, FALLBACK textarea story |
| **Ordering Note** | Feature-layer ADR. Closes the last remaining v0 ADR gap (TR-game-export-001..004). |

## Context

### Problem Statement

The Game Export & Share GDD specifies a three-tier delivery mechanism for the
"Analyze with Claude" payload (Web Share API → Clipboard API → fallback textarea) with
two invariants the GDD repeatedly emphasises but no existing ADR formalises:

1. **The payload assembler must be a pure synchronous function** — no `async` keyword,
   no awaited I/O, no `Promise`-returning data fetches before the clipboard write.
2. **The Tier 1 vs Tier 2 branch must be decided synchronously inside the tap handler**,
   before any `await`, because iOS Safari's user-activation window is consumed by the
   first asynchronous API call. Once `navigator.share()` has been invoked, the gesture
   is spent and `clipboard.writeText()` cannot be retried in the same handler.

These invariants are not optional implementation details — they are correctness
requirements. A TypeScript change that later makes the assembler `async` (e.g., to fetch
a username from Supabase) silently breaks export on iOS without any test failure on
desktop, because the assembler still compiles and the desktop Playwright test still passes.

This ADR formalises the contract at the type-and-architecture level so violations become
structural compile-time or static-analysis failures, not runtime regressions discovered
by an iOS user.

It also locks four additional decisions the GDD leaves open at the architecture layer:

3. **Assembler signature shape** — exact function signature and config injection model
4. **Delivery state machine ownership** — Vue component vs composable vs Pinia store
5. **FALLBACK textarea reveal mechanism** — Vue `v-if` vs persistent hidden element
6. **CSP compatibility envelope** — confirm Clipboard API and Web Share API operate
   under the meta-CSP established by ADR-0008

### Constraints

- **iOS Safari 16.0–16.3 user-activation requirement** — `clipboard.writeText()` must be
  invoked within the synchronous call stack of the user-gesture event handler. Awaiting
  any Promise before this call breaks the activation chain.
- **`navigator.share()` consumes the gesture on call** — even before the share sheet
  opens. A second async API invoking the gesture (`writeText` retry) fails with
  `NotAllowedError` on iOS.
- **CompletedGame is owned by GameLifecycle** (ADR-0005; registered
  `completed_game_via_event` forbidden pattern) — GameExport must read
  `gameStore.completedGame`, never an event payload or route state.
- **CompletedGame is frozen via `Object.freeze`** (ADR-0005) — assembler must treat it
  as read-only; no in-place mutation.
- **GitHub Pages CSP** (ADR-0008) is delivered via `<meta http-equiv>` — Clipboard API
  and Web Share API are platform APIs, not subject to `script-src`/`connect-src`, but
  the meta-CSP must not introduce restrictions that block their use (none currently).
- **No network, no persistence in v0** (GDD Core Rule 10) — assembler is pure: no
  `fetch`, no Supabase calls, no `sessionStorage` writes during export.
- **Touch target ≥ 44 × 44 px** for both the primary "Analyze with Claude" button and
  the FALLBACK dismiss button (GDD UI Requirements).
- **Pillar 3 (No Pressure)** — export is offered, never required. No auto-trigger, no
  navigation away on success, no telemetry.

### Requirements

- Pure synchronous payload assembler with a structurally-enforced signature
- Tier 1 / Tier 2 branch decided synchronously, before any `await`
- iOS-specific: no SHARING → COPYING fallthrough at runtime
- FALLBACK textarea always available as the guaranteed floor (pre-selected, dismissable
  via tap button — no hover-only affordance)
- State machine: IDLE → SHARING / COPYING → SUCCESS / FALLBACK → IDLE (per GDD §3 table)
- Re-export idempotency (rapid double-tap produces same payload; in-flight taps ignored)
- Zero network calls, zero persistence writes
- Reusable assembler interface ready for Game History MVP

## Decision

### 1. Pure Synchronous Assembler with a TypeScript-Enforced Contract

A single function `assembleExportPayload` is defined in `src/modules/game-export/assemble.ts`:

```typescript
// MUST be a synchronous function — enforced by the return type (string, not Promise<string>)
// and the lack of `async` keyword. TypeScript + linting catch any drift.
export function assembleExportPayload(
  game: CompletedGame,
  config: ExportConfig,
): string {
  // 1. Build PGN via chess.js (sync) — chess.js bundled with vue3-chessboard
  // 2. Derive RESULT_PLAIN from game.result + game.playerColor + game.endReason
  // 3. Fill promptTemplate slots; omit absent-data lines including their trailing newline
  // 4. Return concatenated string — no I/O, no awaits, no side effects
}

export interface ExportConfig {
  readonly promptTemplate: string
  readonly promptTone: 'coach' | 'concise'
  readonly eventTag: string
  readonly siteTag: string
  readonly playerName: string
  readonly aiNameTemplate: string
  readonly includeReviewAnnotations: boolean
  readonly copyMode: 'prompt+pgn' | 'pgn-only'
}
```

**Why this signature shape:**

- `(game, config) => string` — pure, no environmental dependencies, trivially
  unit-testable, byte-deterministic over the same inputs (GDD AC requirement)
- `string` return type (not `Promise<string>`) — adding `async` becomes a TypeScript
  error for any caller that has a sync contract; this is the structural enforcement
  that protects the iOS user-gesture window
- `readonly` modifiers on `ExportConfig` and acceptance of a frozen `CompletedGame`
  prevent accidental mutation of the inputs
- No "current game" implicit dependency — `game` is always passed in, making the
  function reusable by Game History MVP for past games (GDD Bidirectional Consistency
  Note)

**Configuration injection model:** `ExportConfig` defaults live in
`src/config/export-tuning.ts` as `const` exports. The component imports them once at
module-load time. The defaults are not reactive — a user-toggleable settings change
(Polish tier) would require remounting the export control or reading from a Pinia
settings store at gesture time, both of which are synchronous-safe.

### 2. Synchronous Tier Decision at the Top of the Tap Handler

The tap handler's first three operations are all synchronous and complete before any
async API is invoked:

```typescript
function onAnalyzeWithClaudeTap(): void {
  // Operation 1: assemble payload (sync, sub-ms)
  const payload = assembleExportPayload(gameStore.completedGame!, exportConfig)

  // Operation 2: decide tier — purely feature-detection + capability probe (all sync)
  const useTier1 =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ text: payload })

  // Operation 3: invoke the chosen tier — this is where the gesture is "spent"
  if (useTier1) {
    state.value = 'SHARING'
    navigator.share({ text: payload })
      .then(onShareResolved)
      .catch(onShareRejected)   // AbortError → IDLE, others → FALLBACK
  } else if (navigator.clipboard?.writeText) {
    state.value = 'COPYING'
    navigator.clipboard.writeText(payload)
      .then(onClipboardResolved)
      .catch(onClipboardRejected) // NotAllowedError + others → FALLBACK
  } else {
    // Insecure context or no Clipboard API → straight to FALLBACK, no async call
    state.value = 'FALLBACK'
    fallbackPayload.value = payload
  }
}
```

**Key properties enforced by this structure:**

- **No `await` keyword anywhere in the handler** — the function is **not** `async`.
  This is the structural enforcement of "no async boundary before the gesture-bound
  API call".
- The `canShare({ text: payload })` probe receives **exactly the same `{ text }`
  object shape** that `navigator.share` is then called with — no `title`, no `url`,
  no `files`. This matches the GDD Core Rule 8 specification and the existing
  acceptance criterion (`navigator.share` called with `{ text: payload }` only).
- The handler never falls through from SHARING to COPYING at runtime. iOS strictness
  is obeyed by construction: Tier 1 vs Tier 2 is a one-shot branch, not a retry chain.
- Insecure context / undefined `navigator.clipboard`: detected as part of the feature
  probe; falls through directly to FALLBACK before any API call.

### 3. State Machine Owned by a Composable, Not a Store

`useGameExport(gameRef, config)` is a Vue composable that owns the state machine and
the tap handler. It returns:

```typescript
interface UseGameExportReturn {
  state: Readonly<Ref<ExportState>>          // 'IDLE' | 'SHARING' | 'COPYING' | 'SUCCESS' | 'FALLBACK'
  fallbackPayload: Readonly<Ref<string | null>>  // populated when state === 'FALLBACK'
  oversizeWarning: Readonly<Ref<boolean>>    // true if estTokens > promptTokenBudget
  onAnalyzeTap(): void                       // bind to button @click
  dismissFallback(): void                    // bind to FALLBACK dismiss button @click
}
type ExportState = 'IDLE' | 'SHARING' | 'COPYING' | 'SUCCESS' | 'FALLBACK'
```

**Why a composable, not a Pinia store:**

- Export state is **per-screen ephemeral** — it lives only while the post-game screen
  is mounted. It does not need to survive route changes (GameExport is reachable only
  on `/review`, the only screen that hosts the post-game UI).
- A Pinia store would require explicit cleanup on unmount to avoid stale "Copied!" UI
  appearing on a future game's review screen — fragile.
- Composables are unmount-clean by Vue's lifecycle by default.
- No other system needs to read export state (it's a leaf system per the architecture
  document's dependency graph).

The composable internally uses `setTimeout(..., config.feedbackDurationMs)` to revert
SUCCESS → IDLE; this timer is cleared via `onScopeDispose` to prevent the revert
firing after the component has unmounted.

> **Supersession trigger**: if Game History MVP later requires cross-screen
> export-in-flight state (e.g., export started on `/history`, completed on `/review`),
> this composable model must be revisited in a superseding ADR. The reusable
> `assembleExportPayload` function is unaffected — only the state-machine owner changes.

### 4. FALLBACK Textarea — Conditional Render, Pre-selected on Mount

The FALLBACK textarea is rendered via `v-if="state === 'FALLBACK'"`, not a persistent
hidden element. On mount of the textarea, `nextTick` is used to call `el.select()` so
the payload is pre-selected for manual Ctrl/Cmd+C.

```vue
<textarea
  v-if="state === 'FALLBACK'"
  ref="fallbackEl"
  readonly
  :value="fallbackPayload"
  aria-label="Game export payload — copy this and paste into claude.ai"
/>
<button
  v-if="state === 'FALLBACK'"
  type="button"
  @click="dismissFallback"
  aria-label="Close export fallback"
>
  Close
</button>
```

**Why conditional render over a persistent hidden element:**

- A persistent hidden `<textarea aria-hidden="true">` would be discovered by screen
  readers anyway (browser AT trees are not strictly governed by `aria-hidden`) and
  would contain stale payload text.
- Conditional render keeps the DOM tree minimal and removes any "ghost selection" risk
  if a user tabs into a hidden element.
- The FALLBACK dismiss is a real `<button>` (not a `×` glyph, not a click-outside
  region) per GDD UI Requirements — mobile has no hover and the textarea must remain
  selectable.

### 5. CSP Compatibility Envelope (Confirmation, Not Change)

ADR-0008's meta-CSP grants `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`,
`connect-src 'self' https://*.supabase.co`. **The Clipboard API and Web Share API are
not controlled by any CSP directive** — they are user-gesture-gated platform APIs
governed by browser permissions, not by the document's content security policy.
ADR-0010 makes no modifications to ADR-0008's CSP; it only documents the confirmed
compatibility.

**No CSP changes needed** for v0 export. (If a future Phase-2 feature posts the payload
to a remote endpoint, that endpoint must be added to `connect-src` via a new ADR — out
of scope here.)

### 6. Re-export Idempotency and In-flight Tap Suppression

The button is bound to `:disabled="state === 'SHARING' || state === 'COPYING'"`. This
both visually disables the affordance during in-flight promises and structurally
prevents `onAnalyzeTap` from being called twice in the same gesture window.

In SUCCESS, taps are accepted and re-run the handler — same payload, same operation.
The success timer is reset on each tap so the "Copied!" feedback restarts.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  PostGameReview screen mount                                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ <AnalyzeWithClaude>                                    │  │
│  │   const { state, onAnalyzeTap, dismissFallback,        │  │
│  │           fallbackPayload, oversizeWarning } =         │  │
│  │     useGameExport(                                     │  │
│  │       toRef(gameStore, 'completedGame'),               │  │
│  │       exportConfig                                     │  │
│  │     )                                                  │  │
│  │                                                        │  │
│  │   <button :disabled="state==='SHARING'||'COPYING'"     │  │
│  │           @click="onAnalyzeTap">                       │  │
│  │     IDLE: "Analyze with Claude"                        │  │
│  │     SHARING/COPYING: spinner                           │  │
│  │     SUCCESS: "Copied!" / "Shared!" (feedbackDuration)  │  │
│  │   </button>                                            │  │
│  │                                                        │  │
│  │   <textarea v-if="state==='FALLBACK'" readonly />      │  │
│  │   <button   v-if="state==='FALLBACK'" @click=          │  │
│  │     "dismissFallback">Close</button>                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

Tap handler execution sequence (all synchronous until step ➍):

  ➊ payload = assembleExportPayload(game, config)    // pure sync, sub-ms
  ➋ useTier1 = feature-detect + canShare({text})     // pure sync
  ➌ state = 'SHARING' | 'COPYING' | 'FALLBACK'       // pure sync
  ➍ first async call:                                ← gesture spent here
      navigator.share({ text: payload })   (Tier 1)
    or
      navigator.clipboard.writeText(payload) (Tier 2)
    or
      (no async call — straight to FALLBACK textarea)
  ➎ .then() / .catch() → SUCCESS | FALLBACK | IDLE   // post-gesture, async OK

If ➌→➍ is Tier 1 and rejects non-Abort:
  state → 'FALLBACK' (NOT a retry to clipboard — gesture spent on iOS)
If ➌→➍ is Tier 1 and rejects AbortError:
  state → 'IDLE' (user cancelled; no error UI)
If ➌→➍ is Tier 2 and rejects:
  state → 'FALLBACK'
```

### Key Interfaces

```typescript
// src/modules/game-export/assemble.ts — pure sync function (the contract this ADR locks)
export function assembleExportPayload(
  game: CompletedGame,
  config: ExportConfig,
): string

export interface ExportConfig {
  readonly promptTemplate: string
  readonly promptTone: 'coach' | 'concise'
  readonly eventTag: string
  readonly siteTag: string
  readonly playerName: string
  readonly aiNameTemplate: string
  readonly includeReviewAnnotations: boolean
  readonly copyMode: 'prompt+pgn' | 'pgn-only'
}

// src/modules/game-export/useGameExport.ts — Vue composable
export function useGameExport(
  game: Ref<CompletedGame | null>,
  config: ExportConfig,
): {
  state: Readonly<Ref<ExportState>>
  fallbackPayload: Readonly<Ref<string | null>>
  oversizeWarning: Readonly<Ref<boolean>>
  onAnalyzeTap(): void
  dismissFallback(): void
}

export type ExportState = 'IDLE' | 'SHARING' | 'COPYING' | 'SUCCESS' | 'FALLBACK'
```

## Alternatives Considered

### Alternative 1: Async Assembler with Awaited Data Fetch

- **Description**: Make `assembleExportPayload` `async`, allowing a future Supabase
  fetch (e.g., to enrich the prompt with a user-chosen tone preference stored remotely)
  without refactoring the export pipeline.
- **Pros**: Flexibility — supports any future async enrichment without architectural
  change.
- **Cons**: An awaited boundary inside the tap handler consumes the iOS user-activation
  window. The clipboard write that follows the `await` would fail with `NotAllowedError`
  on iOS Safari 16+. The GDD is explicit ("Do NOT `await` an async payload-build before
  the write"). Even with cached data, an `async` signature *allows* future drift toward
  awaited I/O, which TypeScript would not flag.
- **Rejection Reason**: Violates the GDD invariant and creates a silent-failure surface
  on the project's primary mobile target. The structural enforcement (`string`-return
  signature, no `async` keyword) is exactly what this ADR exists to lock down.

### Alternative 2: Pre-Built Payload Cache on Mount

- **Description**: Assemble the payload once when the post-game screen mounts, store
  the string in a `ref`, and at tap time just read the ref and call the delivery API.
- **Pros**: Tap handler becomes trivially short; assembly cost is amortized into mount
  (which is not gesture-bound).
- **Cons**: Stale payloads if config or game data change after mount (Pinia store
  reactivity means `completedGame` should not change after terminal — but defensive
  programming would still want the freshest values at tap time). Adds a "when do I
  rebuild?" question. The actual problem this solves — assembler being slow — does
  not exist (payload assembly is sub-ms per the GDD performance budget).
- **Rejection Reason**: Solves a non-problem. Assembling on tap is fast enough and
  avoids staleness concerns entirely. The pure-sync constraint is what makes "assemble
  at tap" safe; this alternative would still work, but adds complexity for no benefit.

### Alternative 3: Drop Web Share, Always Use Clipboard

- **Description**: Skip Tier 1 entirely — only Tier 2 (Clipboard API) and Tier 3
  (textarea fallback). This collapses the state machine to IDLE → COPYING → SUCCESS /
  FALLBACK.
- **Pros**: Simpler implementation (one fewer branch); no `canShare` probe needed; no
  share-rejection vs share-abort distinction.
- **Cons**: Drops the GDD-specified mobile-first experience. On iOS, Web Share allows
  the player to route the payload directly into apps without going through clipboard
  UI — this is the friction-light path the GDD's Player Fantasy section calls out
  ("hand the scoresheet to a coach in the next room"). The GDD specifies three tiers
  by name and the systems-index lists Tier-1 Web Share as a v0 deliverable.
- **Rejection Reason**: Contradicts the GDD's explicit Tier-1/2/3 design. The complexity
  cost of supporting Web Share is bounded (one feature-detect + one capability probe);
  the UX benefit on mobile is real and the GDD's primary platform is iOS Safari.

## Consequences

### Positive

- TypeScript compiler enforces the `string`-not-`Promise<string>` assembler contract —
  any future drift toward async I/O fails at compile time, not at runtime on iOS
- Synchronous tier decision means iOS user-activation is never accidentally consumed
  before the gesture-bound API call
- Composable scope means export state is unmount-clean by default; no Pinia cleanup
  needed
- Conditional FALLBACK render avoids stale-payload DOM hazards
- Pure `(game, config) → string` signature is directly reusable by Game History MVP
  for past-game export (Bidirectional Consistency obligation from GDD)
- No CSP changes — ADR-0008 envelope unchanged

### Negative

- The `async`-forbidden constraint means future features that *do* need async
  enrichment (e.g., fetching a server-managed prompt template) must restructure:
  prefetch + cache before tap, not awaited inside the handler. This is a discipline
  cost on future work.
- The iOS strict no-fallthrough rule means a failed Web Share on iOS drops the player
  to the manual-copy textarea rather than silently auto-copying for them (GDD-accepted
  tradeoff D2). Slightly rougher recovery, accepted because the alternative is
  technically guaranteed to fail post-gesture.
- The composable-not-store choice means that **if** Game History MVP later requires
  cross-screen export-in-flight state, the composable model must be superseded (see
  Decision §3 supersession trigger). The assembler remains reusable; only the
  state-machine owner would change.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `navigator.canShare({ text })` returns `false` on iPhone Safari 16.0–16.3 for typical payload | Medium | Medium — Tier 1 unreachable on iOS, but Tier 2 still works | **Spike V.C.2**: confirm with real device; if unreachable, document and accept Tier-2 as iOS primary path |
| Clipboard write rejects with `NotAllowedError` despite synchronous gesture (iOS bug or PWA install context) | Low | Medium — falls to FALLBACK, no data loss | FALLBACK textarea always available (Decision §4); verified by Validation §5 |
| Future contributor adds `async` keyword to `assembleExportPayload` without realising the implication | Medium | High — silent iOS failure | TypeScript signature returns `string` (not `Promise<string>`); a lint rule could additionally flag `async` on this exported symbol. Reviewed by `/code-review` as part of any change touching `assemble.ts`. |
| `Object.freeze` on `CompletedGame` causes runtime error if assembler tries to mutate (shouldn't, but defensive concern) | Very Low | Low — TypeError thrown at write attempt | Assembler is pure; no mutation; unit tests verify deterministic output (same input → same output, no in-place changes) |
| Web Share sheet on iOS shows the payload as a 2 KB+ "text" attachment that some share targets cannot handle | Low | Low — user re-taps to choose clipboard | Acceptable per GDD ("Web Share succeeds to useless target → out of our control") |
| Meta-CSP added in a future ADR (e.g., stricter `default-src`) accidentally blocks Clipboard API | Very Low | High — clipboard silently breaks | This ADR documents the CSP compatibility envelope; future CSP changes must verify Clipboard/Web Share still work (call out in ADR-0008 supersession check) |

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| game-export-share.md | Core Rule 8: Tier-1/2/3 delivery (Web Share → Clipboard → textarea) | Decision §2: synchronous tier decision at handler top; Decision §4: FALLBACK textarea on conditional render |
| game-export-share.md | Core Rule 10: No network, no persistence | Decision §1: pure-sync assembler with no I/O; Validation §9: static grep enforcement |
| game-export-share.md | Edge Case: iOS user-gesture requirement (clipboard write synchronous in handler) | Decision §1: TypeScript-enforced sync return type; Decision §2: no `await` before delivery call |
| game-export-share.md | Edge Case: iOS share() once-only (no SHARING → COPYING retry) | Decision §2: Tier branch is one-shot; rejection routes to FALLBACK, never to clipboard retry |
| game-export-share.md | Edge Case: `canShare({ text })` probed synchronously before SHARING | Decision §2: `canShare({ text: payload })` invoked synchronously as part of tier-decision, using the exact `{ text }` shape that `share()` will be called with |
| game-export-share.md | AC: Payload assembler is pure synchronous function (static-verifiable) | Decision §1: `string`-not-`Promise<string>` return type makes async drift a TypeScript error |
| game-export-share.md | AC: Re-export idempotency; in-flight tap suppression | Decision §6: `:disabled` while SHARING/COPYING; SUCCESS taps re-run |
| game-export-share.md | AC: FALLBACK dismiss button (not hover-only); ≥ 44×44 px | Decision §4: explicit `<button>` element, not a glyph or click-outside |
| game-export-share.md | Bidirectional Consistency Note: assembler reusable by Game History MVP | Decision §1: `(game, config) => string` signature accepts any `CompletedGame`, no current-game globals |
| architecture.md GameExport Invariants | "clipboardWriteText() must be called synchronously inside the tap gesture" | Decision §1 + §2: structurally enforced by sync function signatures + no-await handler |
| architecture.md GameExport Invariants | "Payload assembler must be a pure synchronous function (no async boundary before clipboard write)" | Decision §1: explicit TypeScript-enforced contract; this ADR closes the architecture-document gap noted in `architecture-review-2026-05-28.md` §B1 |

## Performance Implications

- **CPU**: Payload assembly is sub-ms (string concatenation + chess.js `.pgn()` on a
  ≤ 200-ply game). Tier decision is three feature-detect calls, < 0.01 ms. Total handler
  synchronous-portion budget: < 5 ms — well within a single-frame budget at 60 fps.
- **Memory**: Payload string is 1–3 KB (GDD Formula 1). Composable holds one
  `Ref<string | null>` for FALLBACK payload; cleared on dismiss. Trivial.
- **Load Time**: No new dependencies. The Game Export module is one composable + one
  pure function + one Vue component (≤ 5 KB minified gzipped including the prompt
  template).
- **Network**: None during export. GameExport is offline-capable by design.

## Migration Plan

No existing GameExport implementation. This ADR establishes the contract for a
greenfield implementation. No migration needed.

If Game History MVP later needs to export past games, it instantiates
`useGameExport(toRef(historyStore, 'selectedGame'), exportConfig)` — same composable,
same pure assembler, different `Ref` source. No code duplication, no contract drift.

## Validation Criteria

1. **[Spike — iOS user-activation pattern]** ⚠️ PARTIAL (2026-05-28)
   Script: `scripts/spike-adr0010-export-gesture-audit.mjs`

   | Check | Result |
   |---|---|
   | Desktop delivery pattern (4 scenarios) | ✅ PASS — correct tier selection + state transitions |
   | canShare probed with `{ text }` only (GDD Rule 8) | ✅ PASS — no title/url/files |
   | Assembler determinism (same input → byte-identical) | ✅ PASS |
   | iPhone Safari 16.0–16.3 real-device verification | ⚠️ DEFERRED — real device session needed before Sprint 3 |

2. **[Spike — `canShare({ text })` reachability]** ⚠️ PARTIAL (2026-05-28)

   | Browser | Result |
   |---|---|
   | Chrome 89+ desktop | ✅ share + canShare + text-only |
   | Firefox 89+ desktop | ⚠️ no navigator.share → Tier 2 as primary desktop path |
   | Safari 15.1+ desktop | ✅ share + canShare (likely) |
   | iOS Safari 16.0–16.3 | ⚠️ DEFERRED — canShare({text}) return value unknown on early 16.x |

   **iOS caveat**: if `canShare({text})` returns `false`, Tier 2 is iOS primary path — still within the 3-tier model; GDD accepts this tradeoff (Risk table entry 1).

3. **[Unit — assembler purity and determinism]**
   - Static check: `assembleExportPayload` declaration has no `async` keyword
   - Static check: return type is `string`, not `Promise<string>` (TypeScript also
     catches this via `tsc --strict`)
   - Runtime: assemble the same fixture game twice → byte-identical outputs
   - Runtime: assemble with a frozen `CompletedGame` → does not throw (no mutation)

4. **[Unit — tier decision branch correctness]**
   With stubs:
   - `navigator.share` defined, `canShare({text})` → `true`: handler invokes `share`
     once with `{ text: payload }`, never invokes `clipboard.writeText`
   - `navigator.share` defined, `canShare({text})` → `false`: handler invokes
     `clipboard.writeText` once, never invokes `share`
   - `navigator.share` undefined: handler invokes `clipboard.writeText` once
   - `navigator.clipboard` undefined: state transitions directly to FALLBACK without
     any API call

5. **[Unit — iOS no-fallthrough invariant]**
   With stubs:
   - Stub `share` to reject with a non-Abort error
   - Confirm `clipboard.writeText` is NOT called after the rejection (spy: 0 calls)
   - Confirm state goes SHARING → FALLBACK (not SHARING → COPYING)

6. **[Unit — share AbortError handling]**
   Stub `share` to reject with `AbortError` → state returns to IDLE, no FALLBACK
   shown, no console error

7. **[E2E — full successful export flow]**
   Playwright: mount post-game screen with a fixture completed game → click
   "Analyze with Claude" → assert `navigator.clipboard.writeText` was called with the
   expected payload → assert button label transitions IDLE → "Copied!" → IDLE after
   `feedbackDurationMs`

8. **[E2E — FALLBACK reveal and dismiss]**
   Playwright: stub `clipboard.writeText` to reject → click button → assert
   `<textarea>` appears with payload pre-selected → assert dismiss `<button>` is
   present, ≥ 44 × 44 px, and clicking it returns state to IDLE

9. **[Static — no `fetch` / Supabase / `sessionStorage` in module]**
   Grep `src/modules/game-export/` for `fetch(`, `supabase`, `sessionStorage` →
   zero matches. (Verifies GDD Core Rule 10 "No network, no persistence".)

## Related Decisions

- [ADR-0005](adr-0005-pinia-store-boundaries-and-completed-game-transport.md) —
  GameExport consumes `gameStore.completedGame`; this ADR confirms that contract and
  adds no new state-ownership claims
- [ADR-0008](adr-0008-csp-headers-and-wasm-deployment-configuration.md) — Clipboard API
  and Web Share API are not affected by the meta-CSP envelope; documented here for the
  CSP-modification check protocol
- `design/gdd/game-export-share.md` — the GDD this ADR implements
- `docs/architecture/architecture.md` GameExport Module Ownership Invariants — this
  ADR formalises the previously-undeclared sync-gesture contract noted in
  `architecture-review-2026-05-28.md` §B1
