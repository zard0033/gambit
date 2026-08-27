# Plan 001: A liveness-probe respawn always settles the in-flight `play()` promise, so the board can never freeze in `AI_THINKING`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f18076a..HEAD -- src/modules/chess-engine/play-engine.ts src/views/PlayView.vue tests/unit/chess-engine/visibility-liveness.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f18076a`, 2026-08-27

## Why this matters

`usePlayEngine` runs an iOS liveness probe (TR-chess-engine-009): if the app was
backgrounded for 60s and the Worker does not answer `isready` within 1s, the
engine terminates the Worker and respawns it. The respawn re-issues the search,
but it does so as a **brand-new `play()` call whose result is thrown away**. The
promise the caller is still awaiting is never resolved and never rejected.

The only caller is `PlayView.vue`'s `requestAiMove()`, which does a bare
`await engine.play(...)` with no timeout. So when this path fires, the game phase
stays `AI_THINKING` forever: no AI move, no error, no fallback, no way back
except a manual page reload. This is on iPhone Safari — the exact platform the
liveness probe was written for.

After this plan lands, every liveness respawn settles the original promise: on a
successful respawn the caller gets the respawned engine's real move; on a failed
respawn the caller gets a rejection and `PlayView`'s existing `catch` fallback
takes over. The board can no longer deadlock.

## Current state

Files involved:

- `src/modules/chess-engine/play-engine.ts` — the engine composable. Holds the
  liveness probe (lines ~156–210) and `play()` (lines ~275–443).
- `src/views/PlayView.vue` — the only caller of `play()`.
- `tests/unit/chess-engine/visibility-liveness.test.ts` — existing probe tests.

**Excerpt A — the probe timeout that orphans the promise**
(`src/modules/chess-engine/play-engine.ts:186-209`):

```ts
    _probeTimer = setTimeout(() => {
      _probeTimer = null
      _probePending = false
      // Worker unresponsive — terminate and respawn
      const checkpoint = _checkpoint
      _checkpoint = null
      if (_worker) {
        _worker.onmessage = null
        _worker.terminate()
        _worker = null
      }
      state.value = 'UNINITIALIZED'
      // Best-effort respawn; original play() Promise is orphaned but engine stays operational
      ;(async () => {
        try {
          await init()
          if (checkpoint && state.value === 'IDLE') {
            play(checkpoint).catch(() => {})
          }
        } catch {
          // init sets CRASHED; nothing more to do
        }
      })()
    }, LIVENESS_PROBE_TIMEOUT_MS)
```

Note the comment on the second-to-last block: the orphaning is acknowledged in
the code. This plan removes it.

**Excerpt B — where the checkpoint is stored, inside `play()`**
(`src/modules/chess-engine/play-engine.ts:368-379`):

```ts
      state.value = 'THINKING'
      // Store checkpoint for liveness probe respawn (TR-chess-engine-009)
      _checkpoint = {
        fen: input.fen,
        skillLevel: input.skillLevel,
        movetimeMs: input.movetimeMs,
        depth: input.depth,
        fallible: input.fallible,
      }
      sendSearch()
```

**Excerpt C — the liveness state block that must gain one more variable**
(`src/modules/chess-engine/play-engine.ts:132-142`):

```ts
  // ---- iOS liveness probe state (TR-chess-engine-009) ----
  let _lastHeartbeatTs = 0
  let _probePending = false
  let _probeTimer: ReturnType<typeof setTimeout> | null = null
  let _checkpoint: {
    fen: string
    skillLevel: number
    movetimeMs: number
    depth?: number
    fallible?: FallibleConfig
  } | null = null
  let _livenessRegistered = false
```

**Excerpt D — the two places inside `play()` that clear `_checkpoint`**
(`src/modules/chess-engine/play-engine.ts:341` inside `startDrain`'s bestmove
handler, and `:427` inside the main bestmove handler):

```ts
            _checkpoint = null       // startDrain() bestmove handler
```

```ts
          _checkpoint = null         // main bestmove handler, just before state.value = 'IDLE'
```

**Excerpt E — the caller, with its existing fallback**
(`src/views/PlayView.vue:186-211`):

```ts
    const engineResult = await engine.play({
      fen: fen.value,
      skillLevel: rung.skillLevel,
      depth: rung.depth,
      movetimeMs: rung.movetimeMs,
      fallible: rung.fallible,
    })
    ...
  } catch {
    // Engine error — treat as AI resignation so the board doesn't stay permanently disabled
    lifecycle.handleAiMove('0000')
  }
```

That `catch` is the safety net this plan reconnects. Do **not** change it.

**Error classes available** (already exported from the same file,
`src/modules/chess-engine/play-engine.ts:34` and `:42`): `CanceledError` and
`EngineTimeoutError`. Use `EngineTimeoutError` for a failed respawn — it is
already the error `startDrain()` uses when the Worker stops responding
(`play-engine.ts:331`).

**Repo conventions that apply here:**

- This file uses **English** comments and JSDoc. `src/modules/memory/*.ts` uses
  Traditional Chinese. Match the file you are editing — for this plan that means
  English comments in `play-engine.ts`.
- Engine state transitions are governed by ADR-0002 (`docs/architecture/adr-0002-*.md`).
  This plan adds **no new state** and changes no transition; it only settles a
  promise that was already being dropped.
- Tests are Vitest, colocated by module under `tests/unit/<module>/`. The probe
  suite already exists: `tests/unit/chess-engine/visibility-liveness.test.ts`.
  It uses a hand-rolled `MockStockfishWorker` and a mock `VisibilityEventTarget`
  injected into `usePlayEngine(factory, eventTarget)` — see that file's lines
  1–60 for the exact setup. Reuse that harness; do not introduce a mocking library.
- Fake timers: the suite uses `vi.useFakeTimers()` / `vi.setSystemTime()` /
  `vi.advanceTimersByTime()`. Follow the same pattern.

## Commands you will need

| Purpose   | Command                                                        | Expected on success        |
|-----------|----------------------------------------------------------------|----------------------------|
| Typecheck | `npm run typecheck`                                             | exit 0, no errors          |
| Tests     | `npm run test:unit`                                             | all pass (831 baseline)    |
| One suite | `npx vitest run tests/unit/chess-engine/visibility-liveness.test.ts` | all pass              |

Do **not** run `npm run test:e2e` — it is a Playwright suite that starts a dev
server and is out of scope for this change.

Do **not** run `npm install`. Dependencies are already installed.

## Scope

**In scope** (the only files you should modify):

- `src/modules/chess-engine/play-engine.ts`
- `tests/unit/chess-engine/visibility-liveness.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `src/views/PlayView.vue` — its `catch` fallback is already correct and is what
  makes this fix work. Changing it would mask whether the fix landed.
- `src/modules/chess-engine/handshake.ts` — shared with the review engine; it
  pins `MultiPV 1` and must not be touched from the play path.
- `src/modules/chess-engine/review-engine.ts` — different engine instance, not
  affected by the liveness probe.
- The values of `BACKGROUND_THRESHOLD_MS` (60_000) and
  `LIVENESS_PROBE_TIMEOUT_MS` (1_000). They come from TR-chess-engine-009. Do
  not tune them.

## Git workflow

- Branch: `advisor/001-settle-orphaned-play-promise`
- Commit messages are **Conventional Commits in Traditional Chinese** in this
  repo. Example from `git log`: `fix(review): 修 precommit-review 抓到的觸控目標與測試覆蓋缺口`.
  A suitable message here: `fix(engine): liveness 重生後結算原本被孤兒化的 play() promise`
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Track the in-flight settlers alongside the checkpoint

In `src/modules/chess-engine/play-engine.ts`, in the liveness state block shown
in Excerpt C, add one variable directly after `_checkpoint`:

```ts
  /**
   * Settlers for the play() promise the checkpoint belongs to. The liveness respawn uses these
   * so a terminated search always settles its caller instead of leaving it pending forever.
   */
  let _checkpointSettlers: {
    resolve: (result: PlayResult) => void
    reject: (err: Error) => void
  } | null = null
```

`PlayResult` is already declared in this file (`play-engine.ts:96`); no new
import is needed.

**Verify**: `npm run typecheck` → exit 0, no errors.
(An "assigned but never used" style error is not expected — this repo's
`vue-tsc` config does not flag unused locals. If it does error, that is a STOP
condition, not something to work around with `// @ts-ignore`.)

### Step 2: Populate the settlers where the checkpoint is set

In `play()`, at the site shown in Excerpt B, set `_checkpointSettlers` in the
same block that sets `_checkpoint`:

```ts
      state.value = 'THINKING'
      // Store checkpoint for liveness probe respawn (TR-chess-engine-009)
      _checkpoint = { ... }                 // unchanged
      _checkpointSettlers = { resolve, reject }
      sendSearch()
```

`resolve` and `reject` are the parameters of the enclosing
`new Promise<PlayResult>((resolve, reject) => { ... })` — they are already in
scope at this point.

**Verify**: `npm run typecheck` → exit 0, no errors.

### Step 3: Clear the settlers everywhere the checkpoint is cleared

`_checkpoint = null` appears in exactly two places inside `play()` (Excerpt D).
Add `_checkpointSettlers = null` immediately after each one. Do not add it
anywhere else in this step.

**Verify**: the two assignments are paired. Run:

`grep -n "_checkpoint = null\|_checkpointSettlers = null" src/modules/chess-engine/play-engine.ts`

Expected: four lines total inside `play()` — each `_checkpoint = null` is
immediately followed by a `_checkpointSettlers = null` on the next line — plus
the one `_checkpoint = null` inside the probe timeout (that one is handled in
Step 4 and will show as unpaired until then).

### Step 4: Settle the original promise from the respawn path

Rewrite the probe timeout body shown in Excerpt A so that it captures the
settlers, and routes the respawned search's outcome back to the original caller:

```ts
    _probeTimer = setTimeout(() => {
      _probeTimer = null
      _probePending = false
      // Worker unresponsive — terminate and respawn
      const checkpoint = _checkpoint
      const settlers = _checkpointSettlers
      _checkpoint = null
      _checkpointSettlers = null
      if (_worker) {
        _worker.onmessage = null
        _worker.terminate()
        _worker = null
      }
      state.value = 'UNINITIALIZED'
      // Respawn and hand the result back to the caller that is still awaiting the terminated
      // search. Leaving it pending deadlocks PlayView in AI_THINKING with no fallback.
      ;(async () => {
        try {
          await init()
          if (checkpoint && state.value === 'IDLE') {
            play(checkpoint).then(
              (result) => settlers?.resolve(result),
              (err: Error) => settlers?.reject(err),
            )
            return
          }
          settlers?.reject(new EngineTimeoutError())
        } catch {
          // init sets CRASHED; the caller's catch turns this into an AI resign.
          settlers?.reject(new EngineTimeoutError())
        }
      })()
    }, LIVENESS_PROBE_TIMEOUT_MS)
```

Three things to get right:

1. `settlers` must be captured into a local **before** `_checkpointSettlers` is
   nulled, exactly as `checkpoint` already is.
2. The `return` after the `play(...).then(...)` matters — without it the
   `settlers?.reject(...)` below would fire and reject a promise that the
   respawned search is about to resolve.
3. When there is no `checkpoint` (probe fired while the engine was idle),
   `settlers` will also be `null`, so `settlers?.reject(...)` is a no-op. That
   is intended — do not add a guard around it.

**Verify**: `npm run typecheck` → exit 0, no errors. Then:

`grep -n "Promise is orphaned" src/modules/chess-engine/play-engine.ts`

Expected: no matches (the comment acknowledging the bug is gone).

### Step 5: Add the regression tests

Open `tests/unit/chess-engine/visibility-liveness.test.ts`. There is an existing
test named `test_visibilityProbe_preservesRequestId_throughRespawn` at
approximately line 180. At line ~190 it contains:

```ts
    playPromise.catch(() => {}) // suppress unhandled rejection
```

That line is why this bug survived: the one test that reaches this code path
silences the promise instead of asserting on it. Leave that existing test alone
— it asserts something different (stale-bestmove race guarding). Add **two new
tests** after it, in the same `describe` block, using the same mock harness and
fake-timer style already used in that file.

Test 1 — `test_visibilityProbeRespawn_resolvesOriginalPromise_whenRespawnSucceeds`:

- Initialize the engine and complete the handshake the same way the existing
  tests do.
- Start a `play()` and keep a reference to the returned promise.
- Advance the system time past `BACKGROUND_THRESHOLD_MS` (60_000), dispatch
  `visibilitychange`, then advance timers past `LIVENESS_PROBE_TIMEOUT_MS`
  (1_001ms) so the probe times out and the respawn begins.
- Drive the newly created mock Worker (it will be the next entry in the
  `workers` array the factory pushes into) through its handshake, then have it
  emit a `bestmove` line.
- Assert the **original** promise resolves, and that its `bestMove` is the move
  the respawned Worker reported.

Test 2 — `test_visibilityProbeRespawn_rejectsOriginalPromise_whenRespawnFails`:

- Same setup, but make the respawn fail (e.g. have the factory's next Worker
  never complete the handshake, so `init()` throws / leaves state `CRASHED`).
- Assert the original promise **rejects** rather than staying pending. Use
  `await expect(playPromise).rejects.toBeInstanceOf(EngineTimeoutError)`.
- `EngineTimeoutError` must be imported from
  `../../../src/modules/chess-engine/play-engine` — match the existing import
  style at the top of the file.

Both tests must fail if Step 4 is reverted. If you can, sanity-check that by
temporarily restoring `play(checkpoint).catch(() => {})` and confirming both new
tests go red, then restore your fix.

**Verify**: `npx vitest run tests/unit/chess-engine/visibility-liveness.test.ts`
→ all tests in the file pass, and the file reports **2 more tests than before**.

### Step 6: Full suite

**Verify**:
- `npm run typecheck` → exit 0
- `npm run test:unit` → 0 failed. Baseline before this plan was **831 passed /
  70 files**; expect **833 passed** after adding two tests.

## Test plan

- New tests: two, in `tests/unit/chess-engine/visibility-liveness.test.ts`
  (do not create a new file — the probe suite already exists and shares the mock
  harness).
  - happy path: respawn succeeds → original promise resolves with the respawned
    search's move.
  - failure path: respawn fails → original promise rejects with
    `EngineTimeoutError` instead of hanging.
- Structural pattern to copy: the existing
  `test_visibilityProbe_preservesRequestId_throughRespawn` test in the same file
  (mock worker array, `vi.setSystemTime`, `target.dispatch(new Event('visibilitychange'))`,
  `vi.advanceTimersByTime(1_001)`).
- Not covered here and deliberately so: whether the respawned engine picks the
  *same* move as the terminated one. It will not, and it does not need to.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:unit` exits 0 with 833 passed, 0 failed
- [ ] `grep -n "Promise is orphaned" src/modules/chess-engine/play-engine.ts` returns no matches
- [ ] `grep -c "_checkpointSettlers" src/modules/chess-engine/play-engine.ts` returns exactly 6
      (declaration, the assignment in `play()`, two clears in `play()`, the probe's
      capture, the probe's clear — no other site should reference it)
- [ ] `git status --porcelain` shows changes to exactly two files:
      `src/modules/chess-engine/play-engine.ts` and
      `tests/unit/chess-engine/visibility-liveness.test.ts`
      (plus `plans/README.md` for the status row). Nothing else.
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts —
  in particular if `play-engine.ts` no longer contains the comment
  `// Best-effort respawn; original play() Promise is orphaned` at around line 197.
  That means the bug was already fixed and this plan is stale.
- `npm run test:unit` was already failing **before** you made any change. Record
  the failure count and stop; this plan assumes a green baseline of 831.
- A verification fails twice after a reasonable fix attempt.
- The fix appears to require touching `src/views/PlayView.vue` or any other
  out-of-scope file.
- You discover that `resolve`/`reject` are not in lexical scope at the point in
  Step 2 where the checkpoint is assigned (i.e. the promise construction has
  been refactored since this plan was written).
- `npm run test:unit` fails with ~90 files failing, "no tests", and
  `import 0ms` — this is a known poisoned Vite cache in this repo, not your bug.
  Report it and stop; the fix is a maintainer action
  (`mv node_modules/.vite node_modules/.vite-poisoned`).

## Maintenance notes

- Anyone refactoring `play()`'s promise construction must keep the
  `_checkpointSettlers` assignment adjacent to the `_checkpoint` assignment.
  The two are a pair; splitting them re-opens this bug silently.
- If a cancellation path is ever added that clears `_checkpoint` (a third site),
  it must clear `_checkpointSettlers` too — otherwise a later probe could settle
  a promise that was already rejected. Double-settling is harmless in JS but
  masks the real ordering bug.
- A reviewer should scrutinise: that the `return` in Step 4 is present, and that
  the new tests actually go red when the fix is reverted (a test that passes both
  ways is what let this bug through the first time).
- Deliberately out of scope: adding a caller-side timeout in `PlayView.vue`. It
  would be a second, independent safety net; worth considering separately, but
  layering it in here would make it impossible to tell which mechanism fixed the
  freeze.
