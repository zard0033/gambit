# Plan 002 — REJECTED (2026-08-27): the premise is false, do not execute

> **This plan is wrong. Do not run it.** It was rejected on 2026-08-27, during
> Step 1, by its own STOP condition ("an existing test asserts the old behaviour
> deliberately — report the test name and stop").
>
> **Why it is wrong**: the plan claims unconsumed missed mates from an older game
> become *permanently* unreachable once a newer game is captured. They do not.
> `pendingFor` picks the latest game **among the still-unconsumed sources**, so
> once the newer game's drills are consumed, the older game's entries become the
> latest unconsumed and surface next. It is a queue, one game at a time — not a
> drop. `tests/unit/stores/recognition-source-store.test.ts:70`
> (`test_pendingFor_fallsToOlderGameWhenLatestFullyConsumed`) pins exactly that,
> and `:119` pins the interaction with the trim. The behaviour is designed and
> tested, not an oversight.
>
> **What was actually true**: only the citations. `pendingFor` really does filter
> to one `gameId`, and the comments really do say "only ever serves the latest
> game". The finding drew a false consequence from accurate evidence — which is
> the failure mode an audit that verifies `file:line` does not catch.
>
> **The one real, deliberate loss** (not a bug, not worth a plan):
> `RECOGNITION_SOURCE_GAMES_MAX = 3` (`src/config/learning-loop-tuning.ts:44`),
> so a 4th distinct game evicts the oldest game's unconsumed entries. That is the
> localStorage bound, it is intentional, and `:119` covers it.
>
> Everything below is the original plan, kept unexecuted as the record.

---

## Original plan (rejected — see above)

### Plan 002: `pendingFor` serves unconsumed missed mates from every retained game, not just the newest one

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f18076a..HEAD -- src/stores/recognition-source.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f18076a`, 2026-08-27

## Why this matters

The product's stated purpose, quoted verbatim from
`production/positioning-v2-2026-08-02.md:9`:

> **Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**

The store that holds "tomorrow's questions" is `src/stores/recognition-source.ts`.
It correctly persists the missed mates of up to `RECOGNITION_SOURCE_GAMES_MAX`
distinct games — but the function that hands them to the UI, `pendingFor`, filters
down to **one** game: whichever was written last. If the player finishes two games
before working through either one's drills, the first game's missed tactic becomes
permanently unreachable. It is still in storage; nothing will ever serve it.

After this plan lands, `pendingFor` returns unconsumed sources from all retained
games, oldest first, still capped at `RECOGNITION_SOURCE_MAX`, so a backlog
actually drains instead of being silently skipped.

## Current state

File: `src/stores/recognition-source.ts` — the Pinia store for missed-mate drill
sources. Two functions matter.

**Excerpt A — `pendingFor` as it exists today** (`src/stores/recognition-source.ts:96-108`):

```ts
  /**
   * Unconsumed sources for a concept, from the most recent game only (the latest still-pending game
   * in insertion order), capped at `RECOGNITION_SOURCE_MAX`. v1 handles only 'mate'. Kill switch:
   * when `RECOGNITION_MISSED_MATE_ENABLED` is false, always empty — even for sources persisted
   * before the flag was flipped off.
   */
  function pendingFor(conceptId: string): MissedMateSource[] {
    if (!RECOGNITION_MISSED_MATE_ENABLED) return []
    if (conceptId !== 'mate') return []
    const unconsumed = sources.value.filter((s) => !consumed.value.has(idOf(s)))
    if (unconsumed.length === 0) return []
    const latestGameId = unconsumed[unconsumed.length - 1].gameId
    return unconsumed.filter((s) => s.gameId === latestGameId).slice(0, RECOGNITION_SOURCE_MAX)
  }
```

The two lines to remove are the `latestGameId` binding and the
`s.gameId === latestGameId` filter.

**Excerpt B — `captureMate`'s doc comment, which must be corrected too**
(`src/stores/recognition-source.ts:64-70`):

```ts
  /**
   * Capture the missed mates of one game. Idempotent: skips ids already stored or already consumed,
   * so re-reviewing the same game never double-inserts (dedup keyed `gameId:ply`). After inserting,
   * trims `sources` down to the `RECOGNITION_SOURCE_GAMES_MAX` most-recently-written distinct games —
   * unconsumed entries from older games are dead weight (`pendingFor` only ever serves the latest
   * game) and would otherwise grow localStorage without bound.
   */
```

The parenthetical "(`pendingFor` only ever serves the latest game)" becomes false
after this change. The **trim itself stays** — it is what bounds localStorage. Only
the stated reason changes.

**Do not change** `RECOGNITION_SOURCE_GAMES_MAX` or `RECOGNITION_SOURCE_MAX`. Find
their current values with
`grep -rn "RECOGNITION_SOURCE_GAMES_MAX\|RECOGNITION_SOURCE_MAX" src/config/` and
leave them as they are.

**Repo conventions that apply here:**

- `src/stores/*.ts` are Pinia stores using the setup-store style (`defineStore('x', () => {...})`).
- Comments in this file are **English**. Match that.
- Domain vocabulary, from `CONTEXT.md`: the drill screen these sources feed is
  called **判斷場** (in code: `Recognition*`). A **唯一解局面** is a position with
  exactly one correct move — `selectMissedMates` only emits those. Use those terms
  in comments rather than inventing new ones.
- Tests live at `tests/unit/` mirroring the source path. Look for the existing
  suite with `ls tests/unit | grep -i recognition` and, if one covers this store,
  extend it rather than creating a new file.

## Commands you will need

| Purpose   | Command                                             | Expected on success     |
|-----------|-----------------------------------------------------|-------------------------|
| Typecheck | `npm run typecheck`                                  | exit 0, no errors       |
| Tests     | `npm run test:unit`                                  | all pass (831 baseline) |

Do **not** run `npm run test:e2e`. Do **not** run `npm install`.

## Scope

**In scope** (the only files you should modify):

- `src/stores/recognition-source.ts`
- the existing unit test file covering this store (locate it in Step 1); create
  `tests/unit/recognition-source/pending-across-games.test.ts` only if no suite
  for this store exists.

**Out of scope** (do NOT touch, even though they look related):

- `src/modules/learning-loop/recognition-runtime.ts` — it consumes whatever
  `pendingFor` returns and needs no change.
- `src/config/*` — the two cap constants are product tuning, not this fix.
- `captureMate`'s trimming logic — only its comment changes.
- `src/views/RecognitionFieldView.vue` and any carousel/UI code. If more boards
  now appear at once, that is the intended behaviour; UI capacity is a separate
  question and is explicitly deferred (see Maintenance notes).

## Git workflow

- Branch: `advisor/002-pending-across-retained-games`
- Conventional Commits in Traditional Chinese, e.g.
  `fix(recognition): pendingFor 改為服務所有保留局，舊局的漏殺不再被跳過`
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Locate the existing test coverage

Run `ls tests/unit | grep -i recognition` and
`grep -rln "pendingFor" tests/`.

Record which file(s) already exercise `pendingFor`. You will extend the one that
does. If nothing does, you will create the new file named in Scope.

**Verify**: you can state the path of the test file you will edit.

### Step 2: Widen `pendingFor`

Replace the body of `pendingFor` shown in Excerpt A so it no longer narrows to one
game. Keep every other guard exactly as-is (the kill switch, the `'mate'` guard,
the `RECOGNITION_SOURCE_MAX` cap).

Target shape:

```ts
  /**
   * Unconsumed sources for a concept, across every game still retained in `sources`
   * (oldest first, so a backlog drains in order), capped at `RECOGNITION_SOURCE_MAX`.
   * v1 handles only 'mate'. Kill switch: when `RECOGNITION_MISSED_MATE_ENABLED` is false,
   * always empty — even for sources persisted before the flag was flipped off.
   */
  function pendingFor(conceptId: string): MissedMateSource[] {
    if (!RECOGNITION_MISSED_MATE_ENABLED) return []
    if (conceptId !== 'mate') return []
    return sources.value
      .filter((s) => !consumed.value.has(idOf(s)))
      .slice(0, RECOGNITION_SOURCE_MAX)
  }
```

`sources.value` is already in insertion order, so "oldest first" needs no
explicit sort — do not add one.

**Verify**: `npm run typecheck` → exit 0. And
`grep -n "latestGameId" src/stores/recognition-source.ts` → no matches.

### Step 3: Correct `captureMate`'s doc comment

In the comment shown in Excerpt B, replace the now-false parenthetical. The trim
still exists and still needs a stated reason — the reason is the storage bound,
not `pendingFor`'s behaviour. Target wording for that clause:

```
   * trims `sources` down to the `RECOGNITION_SOURCE_GAMES_MAX` most-recently-written distinct games,
   * which bounds localStorage growth. `pendingFor` serves every game still retained here, so trimming
   * is the only thing that ever drops an unconsumed source.
```

**Verify**: `grep -n "only ever serves the latest" src/stores/recognition-source.ts`
→ no matches.

### Step 4: Add the regression test

In the file identified in Step 1, add a test named
`test_pendingFor_returnsUnconsumed_acrossMultipleRetainedGames`:

- Call `captureMate` twice with **two different `gameId` values**, each with at
  least one missed mate, and consume neither.
- Assert `pendingFor('mate')` returns entries from **both** games — assert on the
  set of distinct `gameId` values in the result, not on array length alone.
- Assert the result is ordered oldest-game-first (the first entry's `gameId` is
  the one captured first).

Add a second test `test_pendingFor_excludesConsumed_acrossGames`: capture two
games, mark one game's entries consumed via the store's existing consume API
(find it with `grep -n "function " src/stores/recognition-source.ts`), and assert
only the other game's entries come back.

Both tests must fail if Step 2 is reverted. Sanity-check that by temporarily
restoring the `latestGameId` filter and confirming they go red.

Pinia setup note: if the existing suite calls `setActivePinia(createPinia())` in a
`beforeEach`, follow that. If it stubs `localStorage`, follow that too — do not
introduce a different persistence stub.

**Verify**: `npx vitest run <the test file you edited>` → all pass, with 2 more
tests than before.

### Step 5: Full suite

**Verify**:
- `npm run typecheck` → exit 0
- `npm run test:unit` → 0 failed; expect **833 passed** (baseline 831 + 2 new).

## Test plan

- Two new tests, in the store's existing suite (see Step 1):
  - unconsumed sources from two retained games both come back, oldest first;
  - consumed entries are still excluded when more than one game is retained.
- Structural pattern: whatever the existing `recognition-source` suite already
  does for Pinia setup and localStorage stubbing. Copy it exactly.
- Not covered and deliberately so: the `RECOGNITION_SOURCE_GAMES_MAX` trim
  behaviour — it is unchanged by this plan and presumably already tested.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:unit` exits 0 with 833 passed, 0 failed
- [ ] `grep -n "latestGameId" src/stores/recognition-source.ts` returns no matches
- [ ] `grep -n "only ever serves the latest" src/stores/recognition-source.ts` returns no matches
- [ ] `grep -n "RECOGNITION_SOURCE_MAX" src/stores/recognition-source.ts` still returns a match
      inside `pendingFor` (the cap was not dropped along with the filter)
- [ ] `git status --porcelain` shows changes to exactly two files (the store and
      its test suite), plus `plans/README.md`. Nothing else.
- [ ] `plans/README.md` status row for 002 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `pendingFor` in the live file does not match Excerpt A — the store has been
  refactored and this plan is stale.
- `npm run test:unit` was already failing before you made any change. Record the
  count and stop; this plan assumes a green baseline of 831.
- Removing the single-game filter breaks an **existing** test that asserts
  "only the latest game is served". That test encodes the old behaviour
  deliberately; changing it is a product decision, not an executor decision.
  Report the test name and stop.
- The fix appears to require touching a view or the config constants.
- `npm run test:unit` fails with ~90 files failing, "no tests", and `import 0ms`
  — known poisoned Vite cache in this repo, not your bug. Report and stop.

## Maintenance notes

- `RECOGNITION_SOURCE_GAMES_MAX` is now the **only** mechanism that drops an
  unconsumed source. If that cap is ever lowered, drills from older games start
  disappearing again — this time silently and for a different reason.
- Deliberately deferred out of this plan: what the 判斷場 UI does when a large
  backlog arrives at once. `RECOGNITION_SOURCE_MAX` already caps the returned
  list, so there is no unbounded render — but the pacing question (should a
  backlog be spread over several sessions?) is a product call, not a bug fix.
- A reviewer should scrutinise: that the `RECOGNITION_SOURCE_MAX` cap survived
  the rewrite, and that the new tests assert on distinct `gameId` values rather
  than on length.
