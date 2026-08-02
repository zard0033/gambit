# Game Export / Share

> ⚠️ 2026-08-02：Tier-1/2/3 分享 UI 與其 composable 已移除（positioning-v2 D7），本 GDD 未實作／已撤除。
> PGN 組裝（assembler.ts）仍在服役。

> **Status**: Designed (pending review)
> **Author**: Eason + Claude
> **Last Updated**: 2026-05-27
> **Implements Pillar**: Pillar 2 (Knowledge Connects to Play) — extends the analytical voice off-app to Claude.ai when no in-app Claude API exists yet; honors Pillar 3 (No Pressure) by being an offered convenience, never a required step
> **Priority**: v0 / Feature
> **Depends on**: Game Lifecycle (current completed game); optionally Game History (MVP — past games)
> **Depended on by**: None (leaf feature; Game History MVP extends it but does not require it)

## Overview

Game Export / Share is the v0 hook that turns a finished game into something the player can *understand*, before the app has any in-app Claude integration. It serializes the just-completed game into standard **PGN** (the universal chess interchange format) and wraps that PGN in a **pre-formatted Claude.ai prompt** — a block of natural-language instructions that tells Claude how to analyze the game like a coach. The player taps one button, the PGN-plus-prompt lands on their clipboard (or the native share sheet on mobile), they paste it into claude.ai, and seconds later they have a plain-English review of their game.

This is the cheapest possible bridge to the product's eventual Phase 2 promise (in-app natural-language explanations) — it costs no API key, no backend, no per-request fee, and it validates the core hypothesis that players *want* conversational analysis of their games. The system is deliberately small: it owns string assembly (PGN serialization + prompt templating) and the browser delivery mechanism (Clipboard API with a Web Share API path on mobile and a visible-textarea fallback). It owns no chess logic, no game state, and no engine analysis — it receives a completed game from Game Lifecycle and produces text.

The player experiences it as a single "Analyze with Claude" affordance on the post-game screen. Everything underneath — PGN tag formatting, special-move notation, clipboard permission quirks on iOS, prompt token budgeting — is invisible to them.

## Player Fantasy

The player has just finished a game. They lost, or scraped a draw, or won but aren't sure why. They want to know *what actually happened* — and the answer is one tap away. They press "Analyze with Claude," the button flashes "Copied," they switch to claude.ai, paste, and a patient explanation unfolds: which opening they played, where the game turned, what they could have done at move 14. It feels like handing your scoresheet to a coach in the next room and getting an answer before you've finished your coffee.

The fantasy is **continuity of the analytical voice**. In v0 the app can show Stockfish's numbers (Post-Game Review), but numbers aren't a coach. Claude.ai is. This system is the seam that makes the app feel like it already has the Phase 2 coaching voice — the player just supplies the final hop by pasting.

Critically, this honors **Pillar 3 (No Pressure)**: exporting is an *offer*, never a chore. There is no "you must analyze this game" nag, no streak for analyzing, no penalty for skipping. The player who just wants to play another game closes the screen and the export quietly waited for nobody. The player who's curious gets a frictionless path to insight.

**Reference points:**
- **lichess "Share & export" menu** — clean, unobtrusive, PGN/FEN/GIF options behind one affordance; we take the unobtrusiveness, narrow to one primary action
- **A coach in the next room** — you hand over the game and get conversational analysis, not a grade or a leaderboard position

**Explicitly NOT this system's job:**
- No in-app rendering of Claude's response (v0 has no Claude API — the player reads it on claude.ai). In-app explanations are Phase 2.
- No move classification, eval numbers, or opening name *generation* — those come from Post-Game Review / Opening Identification and are merely *consumed* into the prompt if available.
- No social sharing to Twitter/Discord/etc. as a feature goal — Web Share API is used purely as the mobile clipboard-equivalent delivery mechanism, not to encourage broadcasting.
- No "you should analyze this" prompting, badges, or streaks for using export.

## Detailed Design

### Core Rules

1. **One primary action, current game only (v0).** The post-game screen shows a single "Analyze with Claude" affordance. It exports *the game that just finished*. Exporting past games is a Game History (MVP) extension — see Dependencies — and is out of v0 scope.
2. **Two artifacts, one operation.** A single tap produces one clipboard payload that contains both the PGN and the prompt. The PGN is embedded inside the prompt template (inside a fenced code block) so the player pastes once and Claude receives both the instructions and the game. There is no separate "copy PGN only" button in v0 (it's a Tuning Knob / future option, see §7).
3. **PGN is standard and portable.** The serialized PGN must be valid per the PGN standard so it also opens in lichess, chess.com, SCID, or any other tool — Claude.ai is the primary target but not the only one. PGN is produced by `chess.js`'s `.pgn()` after replaying the game's moves (the same `chess.js` instance the rest of the app standardizes on).
4. **Required PGN Seven Tag Roster + sensible values:**
   - `Event` — fixed app label, default `"Chess Training Companion"` (Tuning Knob)
   - `Site` — fixed app label, default `"Chess Training Companion (local)"` (no real URL in v0; Tuning Knob)
   - `Date` — game completion date in PGN format `YYYY.MM.DD` (from Game Lifecycle's `completedAt` timestamp, rendered in the player's local timezone)
   - `Round` — `"-"` (rounds are meaningless for single training games; PGN spec uses `-` for "not applicable")
   - `White` / `Black` — one side is the player, the other is the AI. Player side label default `"Player"`; AI side label default `"Stockfish (level {{N}})"` (the `aiNameTemplate` knob — `{{N}}` is filled from Game Lifecycle's `aiSkillLevel` when available, else the parenthetical is dropped and the label is just `"Stockfish"`). Which name goes in `White` vs `Black` is determined by Game Lifecycle's `playerColor`.
   - `Result` — `"1-0"`, `"0-1"`, `"1/2-1/2"`, or `"*"` (game in progress / abandoned), mapped from Game Lifecycle's result.
5. **Optional / supplemental PGN tags** (included when the data is present, omitted cleanly otherwise — never emit empty-string tags):
   - `Termination` — **PGN-standard values only.** The PGN spec's `Termination` tag describes the *reason for the game's conclusion* with a small controlled vocabulary, not the chess outcome. To keep the export standard-portable (Core Rule 3), every normally-concluded game — checkmate, stalemate, and all draw variants — maps to `"normal"`; only `endReason: "abandoned"` maps to `"abandoned"`. (`"time forfeit"` is n/a in v0 — no clock.) The fine-grained outcome (checkmated / stalemate / threefold / etc.) is **not** duplicated here; it is carried into the prompt via `RESULT_PLAIN` (§3), which is what Claude actually reads. Mapping table:

     | `endReason` | `Termination` |
     |-------------|---------------|
     | `checkmate` | `normal` |
     | `resignation` | `normal` |
     | `stalemate` | `normal` |
     | `draw-agreement` | `normal` |
     | `threefold` | `normal` |
     | `fifty-move` | `normal` |
     | `insufficient-material` | `normal` |
     | `abandoned` | `abandoned` |
   - `Opening` / `ECO` — populated from Opening Identification if that system has run; omitted if not available. (Soft dependency — see §6.)
   - `TimeControl` — `"-"` in v0 (Pillar 3: no clock). Reserved for future.
6. **Move text follows PGN movetext rules** (handled by `chess.js.pgn()`, but specified here because the prompt quality depends on correctness):
   - Standard Algebraic Notation (SAN): `e4`, `Nf3`, `Bb5`, etc.
   - Castling: `O-O` (kingside), `O-O-O` (queenside) — letter O, not zero.
   - Captures: `exd5`, `Nxe4`. En passant renders as the normal capture SAN (`exd6`) with no special marker — this is correct per the standard; Claude understands it from context.
   - Promotion: `e8=Q`, `gxh8=N`, etc.
   - Check `+`, checkmate `#`.
   - Move numbers: `1. e4 e5 2. Nf3 Nc6 ...`; result token appended at the end (`... 1-0`).
   - **No NAGs, no comments, no variations in v0.** The PGN is bare movetext. (Embedding Post-Game Review classifications as PGN comments like `{Inaccuracy}` is a future enhancement gated on Post-Game Review output — see §6 soft dependency and §7.)
7. **The Claude.ai prompt template is the quality lever.** The PGN alone produces mediocre analysis (Claude will describe moves generically). The prompt frames the request so the output is *coaching*, not narration. The template (draft below) is data-driven — a string template with named slots — so it can be iterated without code changes (Tuning Knob + High-Risk mitigation from systems-index).
8. **Delivery mechanism — capability-tiered, all triggered by the same user gesture:**
   - **Tier 1 — Web Share API** (mobile-first): if `navigator.share` exists AND `navigator.canShare?.({ text })` is true, call `navigator.share({ text })` so the player can route the payload into any app (including pasting into a browser tab for claude.ai). This is the native, friction-light path on iOS Safari. **No `title` field is sent** — it was never defined, share targets ignore it inconsistently for text payloads, and the AC asserts a `{ text }`-only call; `canShare` is therefore probed with `{ text }`, matching exactly what is shared.
   - **Tier 2 — Clipboard API**: if Web Share is unavailable (desktop, or share declines text), call `navigator.clipboard.writeText(payload)`. MUST be invoked synchronously inside the click/tap handler (iOS requires the write to be within the user-gesture call stack — see Edge Cases).
   - **Tier 3 — Fallback textarea**: if both fail (permission denied, insecure context, very old browser), reveal a read-only multiline `<textarea>` containing the payload, pre-selected, with instructions "Copy this text and paste it into claude.ai." This path always works and is the guaranteed floor.
9. **Visible success feedback is mandatory.** On any successful Tier 1/2 path, the button transitions to a "Copied!" / "Shared!" state for ~2s (Tuning Knob `feedbackDurationMs`) then reverts. This is the only confirmation the player gets that the (invisible) clipboard write happened — without it the action feels like it did nothing. (See §5 for the no-feedback edge case being explicitly forbidden.)
10. **No network, no persistence, no telemetry in v0.** Export is a pure client-side string operation. It does not call Supabase, does not log what was exported, and does not store the PGN anywhere (Game History MVP owns persistence separately). The clipboard is the only sink.
11. **Convenience link, not auto-navigation.** After a successful copy, the success state MAY include a secondary affordance "Open claude.ai ↗" that opens `https://claude.ai` in a new tab (`target="_blank" rel="noopener noreferrer"`). We do NOT auto-navigate (would yank the player off the post-game screen against Pillar 3's no-pressure stance) and we cannot pre-fill claude.ai's input (no API for that) — the player still pastes manually. The link is a shortcut, the paste is theirs.

### States and Transitions

The export control is a small UI state machine living on the post-game screen:

| State | Description | Valid input | Transitions |
|-------|-------------|-------------|-------------|
| **IDLE** | Button shows "Analyze with Claude"; game is exportable | tap | **Tier decided synchronously in the gesture** (see below): → SHARING (`navigator.share && canShare({text})` true) / COPYING (otherwise) |
| **SHARING** | `navigator.share({ text })` promise in flight (native sheet open) | OS share-sheet result | → SUCCESS (resolved) / IDLE (user dismissed sheet — `AbortError`) / FALLBACK (share rejected non-abort) |
| **COPYING** | `clipboard.writeText()` promise in flight (sub-ms typically) | promise result | → SUCCESS (resolved) / FALLBACK (rejected: permission/insecure) |
| **SUCCESS** | Button shows "Copied!"/"Shared!"; `feedbackDurationMs` timer running; optional "Open claude.ai ↗" shown | timer fires, tap-again | → IDLE (timer) / re-export (tap-again restarts) |
| **FALLBACK** | Read-only pre-selected textarea revealed with manual-copy instructions | manual copy (no JS event), dismiss | → IDLE (dismiss) — stays available, no auto-hide |

**Notes:**
- The whole machine only exists when the game is in a terminal state. While a game is in progress the export affordance is either absent or disabled (see Edge Cases — exporting an unfinished game).
- **Tier is decided synchronously inside the tap gesture, before any await** (see Edge Cases — iOS user gesture): the handler does the feature-detect `navigator.share && navigator.canShare?.({ text })` *first*, synchronously. If true it enters SHARING and calls `share({ text })`; if false it enters COPYING and calls `clipboard.writeText()`. Because the branch is chosen before the gesture's user-activation is consumed, there is **no runtime SHARING → COPYING fallthrough** — a device that fails `canShare` never enters SHARING in the first place.
- **SHARING → COPYING is removed on the gesture-strict path (iOS).** Once `share()` has been invoked the user gesture is spent, so a non-abort share rejection cannot re-attempt `clipboard.writeText` (the write would fail the iOS user-activation requirement); it goes to FALLBACK instead. A SHARING → COPYING retry is tolerable only as a **desktop-only** convenience (desktop has no strict user-activation window) and is not part of the v0 mobile-first contract.
- A user dismissing the native share sheet (`AbortError`) is NOT an error — return to IDLE quietly, no "failed" message (the player chose not to share). Do not fall through to clipboard (gesture spent, and the user explicitly canceled).

### The Claude.ai Prompt Template (v0 draft)

This is the heart of the system. The template is a named-slot string. Slots in `{{...}}` are filled from available data; if a slot's source system hasn't run (e.g. Opening Identification, Post-Game Review), that line is omitted rather than left blank.

**Byte specification (read before transcribing):** The block below is the **verbatim literal template string** — what the assembler stores character-for-character, before slot substitution. To show its inner ` ```pgn ` fence as literal characters, the block is wrapped in a **four-backtick** outer fence; that outer fence is GDD-markdown only and is **NOT part of the string**. Everything *inside* the four-backtick fence — including the three-backtick ` ```pgn ` line and its closing ` ``` ` line — **is** literal template content: those three backticks are literal characters that must appear in the final payload, not Markdown formatting to be stripped. There are no inline annotations inside the block; each line is exactly the bytes to emit.

**Default template (`promptTemplate` Tuning Knob), "Coach" tone:**

````text
I just played a chess game and I'd like you to review it like a patient coach
helping a beginner improve. I'm an adult learner working through fundamentals.

Here is the game in PGN:

```pgn
{{PGN}}
```

Context:
- I played {{PLAYER_COLOR}} against Stockfish (skill level {{AI_SKILL_LEVEL}}).
- Result: {{RESULT_PLAIN}}.
{{OPENING_LINE}}
{{REVIEW_HINT_LINE}}

Please:
1. Name the opening and tell me, in one or two sentences, the main idea behind it.
2. Walk me through the 2-3 most important moments of the game — where the
   advantage shifted and why — in plain language, not just engine evaluations.
3. Point out one or two recurring habits or mistakes I should work on, with a
   concrete example move from this game.
4. Suggest one specific thing to study or practice next.

Keep it encouraging and concrete. Use move numbers so I can follow along on a board.
Don't just list every move — focus on what will actually help me improve.
````

**Slot contents and omission rule:**
- `{{OPENING_LINE}}`, when present, expands to the literal line `- The opening was {{OPENING_NAME}} ({{ECO}}).` — omitted entirely if no Opening Identification result.
- `{{REVIEW_HINT_LINE}}`, when present, expands to the literal line `- An engine flagged my likely turning points around moves {{MOVE_LIST}}.` — omitted entirely if no Post-Game Review result.
- **Omission is line-plus-newline:** when a slot is omitted, the line it occupies is removed *together with its trailing newline* — no blank line is left behind. Concretely, the slot token and the single `\n` that terminates its line are both deleted, so the following line moves up against the line above. The assembler must not emit an empty line for an omitted slot.

**Design intent of the template (why each part exists):**
- **Role + audience framing** ("patient coach", "adult learner working through fundamentals") steers Claude away from terse engine-speak toward teaching register — directly serving Player Fantasy.
- **Fenced ` ```pgn ` block** — note that claude.ai's input box does **not** render Markdown, so the three-backtick fence is not parsed as a code block by the input UI. Its real purpose is twofold: (a) **visual separation** of the PGN from the surrounding prose so the player can see the game is enclosed, and (b) a **textual pattern Claude recognizes** as a fenced PGN block when reading the message, helping it treat the contents as game notation rather than prose. It is a recognition/separation cue, not a parser directive.
- **Numbered ask list** constrains output to a useful, bounded shape (opening idea → turning points → recurring habits → next step) instead of an unbounded move-by-move dump. This is the single biggest quality lever: an un-structured "analyze this game" prompt yields rambling output.
- **"Use move numbers", "Don't just list every move"** are explicit anti-patterns Claude is told to avoid, learned from the systems-index High-Risk note that prompt quality (not PGN) determines usefulness.
- **Optional context lines** (`OPENING_LINE`, `REVIEW_HINT_LINE`) progressively enrich the prompt when upstream systems have produced data, but the template degrades gracefully to "just PGN + role framing" when they haven't — which is exactly the v0-minimum case where Post-Game Review may not have run yet.

A second built-in tone variant (`promptTone: "concise"`) is reserved as a Tuning Knob (shorter, less hand-holding) — v0 ships only "Coach"; the concise variant is wired as a knob but not surfaced in UI.

### `RESULT_PLAIN` mapping (the `{{RESULT_PLAIN}}` slot)

`RESULT_PLAIN` is a natural-language sentence describing the outcome from the *player's* point of view. It is derived from two `CompletedGame` fields together: `endReason` (how the game ended) and the **win/loss/draw** outcome for the player, which is itself derived from `result` + `playerColor`:

- **Player won** ⇔ (`result === "1-0"` AND `playerColor === "white"`) OR (`result === "0-1"` AND `playerColor === "black"`).
- **Player lost** ⇔ (`result === "0-1"` AND `playerColor === "white"`) OR (`result === "1-0"` AND `playerColor === "black"`).
- **Draw** ⇔ `result === "1/2-1/2"`.
- **Undetermined** ⇔ `result === "*"` (abandoned / in-progress — see below).

The string is then selected by `endReason` × outcome:

| `endReason` | Player won | Player lost | Draw |
|-------------|-----------|-------------|------|
| `checkmate` | `I won by checkmate.` | `I lost — I was checkmated.` | — (not reachable; checkmate is decisive) |
| `resignation` | `I won — my opponent resigned.` | `I lost — I resigned.` | — (not reachable) |
| `stalemate` | — (not reachable) | — (not reachable) | `It was a draw by stalemate.` |
| `draw-agreement` | — | — | `It was a draw by agreement.` |
| `threefold` | — | — | `It was a draw by threefold repetition.` |
| `fifty-move` | — | — | `It was a draw by the fifty-move rule.` |
| `insufficient-material` | — | — | `It was a draw — insufficient material to checkmate.` |
| `abandoned` | `I won — my opponent abandoned the game.` | `I lost — I abandoned the game.` | `The game was abandoned before it finished.` |

**`result: "*"` (Undetermined) handling:** `result === "*"` means abandoned or in-progress (in v0 only `abandoned` reaches export — in-progress export is structurally prevented, see Edge Cases). When `result === "*"`, win/loss cannot be derived, so `RESULT_PLAIN` is the neutral string `The game was left unfinished.` regardless of `endReason`.

**Contradictory combinations** (a `1/2-1/2` result paired with a decisive `endReason` like `checkmate`/`resignation`, or a decisive `result` paired with a draw-only `endReason` like `stalemate`/`threefold`): **this should not occur** — Game Lifecycle is expected to keep `result` and `endReason` consistent. If it does occur, **the `result` token is authoritative**: derive the won/lost/draw bucket from `result` + `playerColor` and select the closest matching cell, falling back to a generic phrasing for that bucket (`I won this game.` / `I lost this game.` / `It was a draw.`) rather than emitting an impossible sentence.

## Formulas

This system is fundamentally **string assembly, not mathematics** — there is no simulation, no scoring, no probability. Stated honestly: the "formulas" here are *quantifiable size/budget constraints* that the assembly must respect, plus the assembly procedure itself. They exist to bound clipboard payload size and to keep the pasted prompt comfortably within a single Claude.ai message.

### Formula 1: Export payload size estimate

`payloadChars = promptTemplateChars + pgnChars`
`pgnChars ≈ pgnHeaderChars + (plyCount × avgCharsPerPly)`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `promptTemplateChars` | int | 600–1200 | Fixed size of the filled template minus the PGN slot. "Coach" default ≈ 900. |
| `pgnHeaderChars` | int | 150–300 | The Seven Tag Roster + optional tags block. ≈ 200 typical. |
| `plyCount` | int | 0–600 | Number of half-moves (plies) in the game. A "long" game ≈ 80-100 ply; pathological max see Edge Cases. |
| `avgCharsPerPly` | float | 4–8 | Average SAN token + spacing/move-number overhead. ≈ 6 (e.g. `Nf3 ` ≈ 4, move-number prefixes amortized). |
| `payloadChars` | int | ~950–~5000 | Total clipboard payload length. |

**Output range and worked example:** A typical 40-move game = 80 ply → `pgnChars ≈ 200 + 80×6 = 680`; `payloadChars ≈ 900 + 680 = 1580` characters. A long 100-move game (200 ply) → `pgnChars ≈ 200 + 200×6 = 1400`; `payloadChars ≈ 2300`. Both are trivially within any clipboard or single-message limit. **Conclusion: payload size is a non-issue for real games** — this formula's value is to *prove* that and to flag only the pathological case (see `maxPlyBeforeWarn` knob and the super-long-game edge case).

### Formula 2: Prompt token budget (Claude.ai single-message comfort)

`estTokens ≈ payloadChars / charsPerToken`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `payloadChars` | int | from Formula 1 | Total payload length |
| `charsPerToken` | float | 3.5–4.5 | English+notation heuristic. Use `4` as the design estimate. |
| `estTokens` | int | ~240–~1250 | Estimated tokens the pasted message consumes |
| `promptTokenBudget` | int (knob) | 2000–8000 | Soft design ceiling. Default `4000`. If `estTokens` exceeds it, the export still proceeds but a non-blocking note is shown (see Edge Cases — super-long game). |

**Output and example:** The 100-move game above (`payloadChars ≈ 2300`) → `estTokens ≈ 575` — far under the 4000 budget. This formula is a *guard*, not a gate: it exists so that if a future feature (e.g. embedding full Post-Game Review annotations as PGN comments) inflates the payload, there is a defined threshold (`promptTokenBudget`) that triggers a warning rather than silently producing an unwieldy paste.

### Assembly procedure (the actual "math" — deterministic string build)

1. Receive `CompletedGame` from Game Lifecycle (see Dependencies for shape).
2. Replay `moves` (assume UCI long-algebraic — see `CompletedGame` shape) through a fresh `chess.js` instance; call `.header(...)` to set the Seven Tag Roster + present optional tags (mapping `endReason` → `Termination` via Core Rule 5's standard-only table); call `.pgn()` → `PGN`.
3. Derive the player's win/loss/draw outcome from `result` + `playerColor`, then select `RESULT_PLAIN` from the **`RESULT_PLAIN` mapping table (§3)** keyed by `endReason` × outcome (handling `result: "*"` and contradictory combinations as specified there).
4. Fill `promptTemplate` slots; omit any line whose source data is absent — removing the line together with its trailing newline (no blank line left behind, per §3's omission rule).
5. Concatenate → `payload`.
6. Compute Formula 1 / Formula 2; if `estTokens > promptTokenBudget`, set `oversizeWarning = true`.
7. Hand `payload` (+ `oversizeWarning`) to the delivery state machine.

This procedure is pure and deterministic given the same `CompletedGame` + template + tag values — which makes it directly unit-testable (a fixed game in → a byte-exact payload out).

## Edge Cases

**Game-state edge cases:**
- **Export invoked on an unfinished / in-progress game:** the export affordance must not be reachable for a non-terminal game. Game Lifecycle exposes a terminal-state flag; the post-game screen only mounts the export control when that flag is true. *If* an unfinished game is ever exported (e.g. future "share position" feature), `Result` MUST be `"*"` and `Termination` MUST be `"abandoned"` (the standard-vocabulary value for a game not played to completion — consistent with Core Rule 5's standard-only mapping) — but in v0 this path is structurally prevented, not handled at runtime.
- **Zero-move game** (player resigns/abandons on move 1, or game ends before any move): PGN movetext is empty, only the result token. `chess.js.pgn()` produces a valid header-plus-`*`/result PGN. Prompt still assembles; the "walk me through the moments" ask gracefully yields "the game was too short to analyze" from Claude — acceptable, not an error.
- **Abandoned game** (`endReason: "abandoned"`): `Result: "*"`, `Termination: "abandoned"`. Export allowed (player may still want the partial PGN) but the success state shows a subtle note "(incomplete game)".

**Special-move PGN correctness:**
- **Castling:** `O-O` / `O-O-O` (capital letter O, NOT zero `0-0`). `chess.js` emits the correct letter form; a unit test asserts this exact byte sequence because some libraries/tools differ.
- **En passant:** rendered as the ordinary capturing SAN (`exd6`) with no annotation. Verified by a fixture game containing a known en-passant capture, asserting the exact SAN.
- **Promotion (incl. underpromotion):** `=Q`, `=R`, `=B`, `=N` suffix, with capture/check as needed (`bxa8=Q+`). Fixture-tested for each promotion piece including knight underpromotion.
- **Disambiguation:** when two like pieces can reach a square, SAN must disambiguate (`Nbd2`, `R1e2`, `Qh4e1`). `chess.js` handles this; fixture-tested with a position requiring file, rank, and full-square disambiguation.
- **Checkmate ends movetext correctly:** final move carries `#` and the result token follows (`... Qh7# 1-0`). Asserted on a mate-in-fixture.

**Clipboard / delivery edge cases:**
- **iOS requires the clipboard write inside the user gesture:** `navigator.clipboard.writeText()` MUST be called synchronously within the tap handler's call stack. **Do NOT** `await` an async payload-build before the write — build the payload *first* (it's synchronous and sub-ms), then call `writeText` as the first async op in the handler. If payload assembly were ever made async, it must complete *before* the gesture, with the gesture only triggering the write. Violating this silently fails on iOS Safari (write resolves to nothing or rejects `NotAllowedError`).
- **Clipboard permission denied / `NotAllowedError`:** transition to FALLBACK (Tier 3 textarea). Never leave the player with no copy path.
- **Insecure context (no HTTPS):** `navigator.clipboard` is undefined outside secure contexts. Feature-detect; if absent, skip directly to FALLBACK. (GitHub Pages is HTTPS so this is mainly a localhost-over-IP / dev concern.)
- **Web Share API unsupported (desktop Chrome/Firefox/Edge):** `navigator.share` undefined → never enter SHARING; go straight to COPYING. This is the *normal* desktop path, not an error.
- **Web Share present but `canShare({text})` false** (some platforms restrict text-only shares): this is detected **synchronously, before entering SHARING**, so the handler simply takes the COPYING branch in the same gesture — it is a pre-decision, not a runtime fall-through out of an in-flight share.
- **iOS: once `share()` is called, do not retry clipboard.** The decision of Tier 1 vs Tier 2 is made synchronously at the top of the gesture (`navigator.share && canShare({text})`). If that is true, the handler commits to share *only* — a non-abort share rejection goes straight to FALLBACK (Tier 3 textarea), **never back to `clipboard.writeText`**, because the user-activation that the clipboard write requires is already consumed by the `share()` call. Re-attempting clipboard after share would reject `NotAllowedError` on iOS. (The SHARING → COPYING retry is permissible only on desktop, where user-activation is not strictly windowed — desktop-only, out of the v0 mobile contract.) **Accepted tradeoff (D2):** on iOS a failed share therefore drops the player straight to the manual-copy textarea rather than silently auto-copying for them — a slightly rougher recovery, accepted because the alternative (an extra clipboard attempt) is technically guaranteed to fail post-gesture and would *look* like a second silent failure. FALLBACK always works, so the player is never stranded.
- **User dismisses the native share sheet (`AbortError`):** not an error — return to IDLE with no message. Do not fall through to clipboard (gesture spent, and the user explicitly canceled).
- **Web Share succeeds but to a useless target** (player shares to Photos, etc.): out of our control and out of scope — the API doesn't report the destination. We treat any non-abort resolution as SUCCESS.
- **No visible feedback would make success indistinguishable from failure:** explicitly forbidden — the SUCCESS state (Core Rule 9) is mandatory. A silent successful clipboard write with no UI change is a defect, not an acceptable outcome.
- **Double-tap / rapid re-tap:** re-exporting is idempotent and harmless (same payload). Tapping during SUCCESS restarts the success timer; tapping during SHARING/COPYING is ignored (button disabled while a promise is in flight).

**Payload-size edge cases:**
- **Super-long game** (e.g. a 300-move shuffling draw, `plyCount` → 600): Formula 2 may push `estTokens` toward/over `promptTokenBudget`. Export still proceeds (we never block the player), but the success state surfaces a non-blocking note: "This is a long game — if Claude's reply gets cut off, paste it in two parts." No truncation is performed automatically (truncating PGN would corrupt the game).
- **Empty / corrupt move data from upstream:** if `chess.js` rejects the move list while replaying (should be impossible if Game Lifecycle validated, but defended anyway), surface a single non-fatal error state "Couldn't build the game export" and log to console; do NOT crash the post-game screen (the player can still see their Stockfish review).

**Data-availability edge cases:**
- **Opening Identification hasn't run / returned no match:** omit the `OPENING_LINE` and the `Opening`/`ECO` PGN tags entirely. The prompt's ask #1 ("Name the opening") still works — Claude infers it from the moves.
- **Post-Game Review hasn't run** (player exports before/without reviewing): omit `REVIEW_HINT_LINE`. The export is fully functional with PGN + role framing alone — this is the expected common v0 path and must be first-class, not degraded.
- **AI skill level unavailable:** `White`/`Black` AI tag falls back to `"Stockfish"`; the prompt's `{{AI_SKILL_LEVEL}}` line drops the "(skill level N)" parenthetical.

**Locale / formatting edge cases:**
- **Date timezone:** `Date` tag uses the player's local date at game completion, formatted `YYYY.MM.DD` with zero-padding. A game finished at 00:30 local must show the local date, not UTC (avoid off-by-one-day confusion). No locale digit substitution — PGN requires ASCII digits.
- **Player display name with special characters / quotes:** PGN tag values are quoted strings; embedded `"` and `\` must be backslash-escaped per PGN spec. In v0 names are app-controlled defaults (`"Player"`, `"Stockfish (level N)"`) so this is low-risk, but the escaper is applied unconditionally for forward-safety against a future custom-name knob.

## Dependencies

### Upstream dependencies (this system depends on)

| System | Status | What we need from it | Interface (handoff requirement) |
|--------|--------|----------------------|--------------------------------|
| **Game Lifecycle** | Approved (v0) | The completed game to serialize | A `CompletedGame` object (shape specified below) — read from the Pinia game store where Game Lifecycle writes it on terminal (Lifecycle Rule 7), and additionally available on the `game-completed` event. The interface below matches Lifecycle's canonical `CompletedGame`; rows marked **(defensive-only, not v0-reachable)** exist for Phase 2 / future emissions and are unreachable through v0 gameplay. |
| **Opening Identification** | Not Started (v0 Foundation) | Opening name + ECO code, if determined | Optional `{ openingName: string, eco: string }`; absence is handled (tags + line omitted). |
| **Post-Game Review** | Not Started (v0 Feature) | Optional hint of turning-point move numbers to enrich the prompt | Optional `{ keyMoveNumbers: number[] }`; absence is handled. |

#### Handoff requirement — `CompletedGame` shape (placed on Game Lifecycle)

Game Lifecycle is now designed (Approved v0). The interface below mirrors Lifecycle's `CompletedGame`, plus the future-reserved `endReason` values (`draw-agreement`, `abandoned`) and `result: '*'` that v0 **does not emit** — these are kept in the type for defensive handling and Phase-2 readiness. **In v0, `result` is always `'1-0' | '0-1' | '1/2-1/2'` (never `'*'`), and `endReason` is one of the six checkmate/resignation/stalemate/threefold/fifty-move/insufficient-material values.** Anything else in the union below is **not v0-reachable** through Lifecycle and should be treated as defensive-only:

```ts
interface CompletedGame {
  moves: string[];          // ordered move list replayable by chess.js.
                            // ASSUME UCI long-algebraic (e.g. "e2e4", "e7e8q") as the
                            //  default: the Chess Engine emits PlayResult.bestMove in UCI,
                            //  so Game Lifecycle most likely holds the move list in UCI.
                            //  Game Lifecycle remains the owner and declares the final
                            //  encoding; this system replays via chess.js regardless and
                            //  lets chess.js convert to SAN at the PGN boundary.
  playerColor: 'white' | 'black';   // which side the human played
  result: '1-0' | '0-1' | '1/2-1/2' | '*';   // standard PGN result token.
                            //  v0-emitted: '1-0' | '0-1' | '1/2-1/2'.
                            //  '*' is defensive-only (Phase 2 / abandoned) — not v0-reachable.
  endReason:                         // maps to PGN Termination tag (standard-only: see Core Rule 5).
                            //  v0-emitted: 'checkmate' | 'resignation' | 'stalemate'
                            //              | 'threefold' | 'fifty-move' | 'insufficient-material'.
                            //  'draw-agreement' and 'abandoned' are defensive-only
                            //  (Phase 2 / future emissions) — not v0-reachable through Lifecycle.
    | 'checkmate' | 'resignation' | 'stalemate'
    | 'draw-agreement' | 'threefold' | 'fifty-move'
    | 'insufficient-material' | 'abandoned';
  completedAt: number;      // epoch ms — source for the Date tag (rendered in local TZ)
  aiSkillLevel?: number;    // 0-20 Stockfish skill level, if known (for White/Black tag)
  isTerminal: true;         // export control only mounts when this is true
  // startFen?: string;     // FUTURE — NOT consumed in v0. v0 does not support custom
                            //  starting positions; all v0 games begin from the standard
                            //  start, so no FEN/SetUp PGN tag is emitted. This field is
                            //  reserved for a future "play from position" feature and is
                            //  intentionally NOT a v0 handoff requirement on Game Lifecycle.
}
```

> **Why a documented handoff and not an assumption:** mirrors how chess-engine-integration.md treats its not-yet-designed consumers — we record what we need from Game Lifecycle as an explicit requirement so the dependency is honest and the Game Lifecycle author has a concrete checklist (see Bidirectional consistency notes).

### Downstream dependents (systems that depend on this)

**None.** Game Export / Share is a leaf feature — no v0 system reads from it. Game History (MVP) *extends* it (see below) but does not *depend on* it.

### External dependencies (third-party libraries)

| Dependency | Version | Purpose | Replaceable? |
|------------|---------|---------|--------------|
| `chess.js` | bundled with vue3-chessboard | Replay moves → produce standard PGN via `.header()` + `.pgn()` | Yes — could hand-roll PGN serialization, but chess.js already guarantees SAN/castling/promotion correctness; reusing it removes an entire class of bugs |
| Browser **Clipboard API** | platform | `navigator.clipboard.writeText` (Tier 2 delivery) | No (it's the platform); fallback textarea (Tier 3) covers absence |
| Browser **Web Share API** | platform | `navigator.share` (Tier 1 mobile delivery) | No (platform); Clipboard path covers absence |

### Soft dependencies (enhanced by but not required)

- **Opening Identification** (v0 Foundation): if it has produced a name+ECO, the prompt and PGN are enriched. If absent, export is fully functional.
- **Post-Game Review** (v0 Feature): if it has run, the prompt may include a turning-points hint line; future enhancement could embed its per-move classifications as PGN comments (`{Mistake}`) — explicitly deferred (Tuning Knob `includeReviewAnnotations`, default off in v0).
- **Game History** (MVP): when it ships, it will reuse this system's PGN serializer + prompt assembler to export *past* games, not just the current one. v0 does not build this; it only ensures the assembly procedure takes a `CompletedGame` (not hidden current-game globals) so History can pass a reconstructed past game in.

### Bidirectional consistency notes

- When **Game Lifecycle** GDD is authored, it MUST declare that, on reaching a terminal state, it exposes a `CompletedGame`-shaped object (or equivalent) with at minimum: `moves`, `playerColor`, `result`, `endReason`, `completedAt`, optional `aiSkillLevel`, `isTerminal`. (`startFen` is **NOT** part of the v0 handoff — v0 has no custom starting positions; it is reserved for a future "play from position" feature and must not be treated as a v0 requirement on Game Lifecycle.) It must also state the `moves` encoding. **Anchor:** the Chess Engine has already fixed `PlayResult.bestMove` as UCI long-algebraic, so Game Lifecycle most likely holds its move list in UCI; all systems consuming `CompletedGame.moves` (Export / Opening Identification / Post-Game Review) should **default to assuming UCI** and let chess.js convert to SAN at their own boundary. Game Lifecycle remains the owner of the encoding, but should default to the engine's UCI output rather than inventing a separate SAN representation. **This handoff requirement is the single hard cross-GDD obligation of this system.**
- When **Opening Identification** GDD is authored, it should note that Game Export consumes its `{ openingName, eco }` output (optionally) for PGN tags and the prompt.
- When **Post-Game Review** GDD is authored, it should note that Game Export may consume an optional turning-points hint, and that a future enhancement may embed Review's move classifications into exported PGN as comments — Post-Game Review owns the classification vocabulary; Export only formats it.
- When **Game History** GDD is authored (MVP), it should declare that it reuses Game Export's serializer/assembler to export past games, and that Export's assembly procedure must therefore remain pure over a passed-in `CompletedGame` (no reliance on "current game" singletons).

## Tuning Knobs

| Knob | Default | Safe Range | What breaks if too high / wrong | What breaks if too low / off |
|------|---------|-----------|---------------------------------|------------------------------|
| `promptTemplate` | "Coach" template (see §3) | any non-empty string with a `{{PGN}}` slot | Bloated/rambly prompt → Claude returns unfocused analysis; payload grows | Too terse → Claude narrates moves instead of coaching (the exact failure the structured asks prevent) |
| `promptTone` | `"coach"` | `"coach"` \| `"concise"` | `"concise"` may under-explain for true beginners | — (only two values) |
| `eventTag` | `"Chess Training Companion"` | short string | Overlong → ugly PGN header, wasted chars | Empty → omit tag (PGN allows, but Seven Tag Roster expects it; keep non-empty) |
| `siteTag` | `"Chess Training Companion (local)"` | short string | — | — |
| `playerName` | `"Player"` | short string, escaped | Special chars must be escaped (handled) | — |
| `aiNameTemplate` | `"Stockfish (level {{N}})"` | short string | — | Drop level if `aiSkillLevel` absent (handled) |
| `feedbackDurationMs` | 2000 | 1000–4000 | Success state lingers, feels stuck | <1000 → player misses the "Copied!" confirmation entirely |
| `promptTokenBudget` | 4000 | 2000–8000 | Warning never fires even on huge pastes → player gets truncated Claude replies unexpectedly | Warning fires on normal games → annoying false alarm |
| `maxPlyBeforeWarn` | 200 | 100–600 | Long-game note never shows | Note shows on ordinary games |
| `includeReviewAnnotations` | `false` (v0) | bool | (when on, Phase 2) inflates payload toward token budget; PGN comments may confuse some parsers | off = no inline classifications (v0 intended state) |
| `showOpenClaudeLink` | `true` | bool | — | off → player must navigate to claude.ai themselves (still fine) |
| `copyMode` | `"prompt+pgn"` | `"prompt+pgn"` \| `"pgn-only"` (future) | `"pgn-only"` skips the coaching frame → worse Claude analysis; reserved for "export to lichess" use | — |

### Interaction notes

- **`promptTemplate` is the highest-leverage knob and the system's #1 design risk** (per systems-index High-Risk table). It must be iterated against *real claude.ai sessions* during v0 build — assemble payloads from a handful of fixture games, paste into claude.ai, and judge whether the output reads like coaching. Treat the default template as a starting hypothesis, not a final value.
- **`promptTemplate` ↔ `promptTokenBudget`**: a richer template (more context lines, embedded annotations via `includeReviewAnnotations`) raises `estTokens`; keep their sum comfortably under a single-message size. Tune together.
- **`feedbackDurationMs` ↔ Player Fantasy "one tap, done"**: the success confirmation is the *only* signal the invisible clipboard write worked. Too short undermines trust ("did it copy?"); too long makes the UI feel laggy. 2s is the readable-but-snappy compromise.
- **`includeReviewAnnotations` is Phase-2-leaning**: turning it on in v0 is allowed but pointless until Post-Game Review's classification output is stable; it is wired now only so the seam exists.

### Source of truth

These values live in a TypeScript config module (e.g. `src/config/export-tuning.ts`) as named exports, alongside the prompt template strings. Settings (Polish tier) does NOT expose these to end users in v0 — they are system-level. A future "choose prompt tone" preference would be a Settings concern, not this system's.

## Visual / Audio Requirements

This system owns exactly one small UI affordance and its states; it has no audio.

- **The "Analyze with Claude" control** on the post-game screen: a button meeting the project's ≥ 44×44px touch-target standard (technical-preferences.md). Primary action styling (it's the screen's invitation to the v0 hook).
- **State visuals** per the §3 state machine: IDLE ("Analyze with Claude"), in-flight (disabled + subtle spinner during SHARING/COPYING), SUCCESS ("Copied!" / "Shared!" with a checkmark, ~`feedbackDurationMs`), FALLBACK (revealed read-only textarea + instructions), error (rare, non-blocking inline message).
- **Open claude.ai ↗ link** (when `showOpenClaudeLink`): secondary affordance in SUCCESS state, also ≥ 44×44px, opens in a new tab.
- **FALLBACK dismiss control:** the FALLBACK state's read-only textarea is accompanied by an explicit **dismiss button** (a tappable `<button>`, e.g. labelled "Done" / "Close", **NOT** a hover-only "×" glyph or a click-outside region — mobile has no hover and the textarea must stay selectable). It meets the ≥ 44×44px touch-target standard. Tapping it transitions FALLBACK → IDLE (the only way out of FALLBACK, since there is no auto-hide per §3).
- **No hover-only affordances** (mobile has no hover — technical-preferences.md). All state changes are driven by tap/click and promise results, not hover.
- The exact layout, copy, and placement on the post-game screen are owned by `/ux-design` for the post-game screen during Pre-Production; this GDD specifies behavior and states, not pixel layout.

## Acceptance Criteria

### PGN serialization correctness

- **GIVEN** a `CompletedGame` with a known 40-move game (fixture) **starting from the standard initial position** (v0 supports no custom starting positions; no `startFen`/`SetUp` tag is emitted), **WHEN** the PGN is built, **THEN** it is valid PGN that `chess.js` can re-load to the identical final position (round-trip), AND contains all Seven Tag Roster tags with correct values.
- **GIVEN** a game containing kingside castling, **WHEN** serialized, **THEN** the movetext contains `O-O` (letter O) and NOT `0-0` (zero).
- **GIVEN** a fixture game with a known en-passant capture, **WHEN** serialized, **THEN** that move renders as the expected capturing SAN (e.g. `exd6`) with no extra annotation.
- **GIVEN** fixture games ending in queen-promotion and in knight-underpromotion, **WHEN** serialized, **THEN** the moves render `=Q` and `=N` respectively (with `+`/`#` if checking).
- **GIVEN** a position requiring file, rank, and full-square disambiguation, **WHEN** serialized, **THEN** SAN disambiguation matches `chess.js` output exactly (e.g. `Nbd2`, `R1e2`, `Qh4e1`).
- **GIVEN** a game ending in checkmate, **WHEN** serialized, **THEN** the final move ends with `#` and is followed by the correct result token (e.g. `... Qh7# 1-0`).
- **GIVEN** `endReason: "resignation"` with `result: "0-1"`, **WHEN** serialized, **THEN** `Result` tag is `"0-1"` AND `Termination` tag is `"normal"` (standard-only vocabulary per Core Rule 5; the "resignation" detail lives in `RESULT_PLAIN`, not the `Termination` tag).
- **GIVEN** `endReason: "abandoned"` with `result: "*"`, **WHEN** serialized, **THEN** `Termination` tag is `"abandoned"` (the only non-`"normal"` value emitted in v0).
- **GIVEN** a game completed at local time 00:30 on 2026-05-27, **WHEN** the Date tag is built, **THEN** it reads `2026.05.27` (local date, zero-padded, ASCII digits) regardless of UTC date.

### Prompt assembly

- **GIVEN** a `CompletedGame` AND no Opening Identification result AND no Post-Game Review result, **WHEN** the prompt is assembled, **THEN** the payload contains the role framing + a fenced ` ```pgn ` block + the numbered ask list, AND contains NO empty/blank context lines (omitted, not left blank).
- **GIVEN** an Opening Identification result `{ openingName: "Italian Game", eco: "C50" }`, **WHEN** the prompt is assembled, **THEN** the context includes a line naming the opening AND the PGN header includes `Opening "Italian Game"` and `ECO "C50"`.
- **GIVEN** the same `CompletedGame` and config, **WHEN** the payload is assembled twice, **THEN** the two payloads are byte-for-byte identical (deterministic — required by testing standards, no time/random in the assembled string except the fixed Date tag).
- **GIVEN** `playerColor: "black"` and `result: "0-1"` and `endReason: "checkmate"`, **WHEN** `RESULT_PLAIN` is built, **THEN** it equals `"I won by checkmate."` (per the RESULT_PLAIN mapping table in §3) — not a loss, not a draw.

### Delivery — Web Share / Clipboard / Fallback

- **GIVEN** `navigator.share` and `navigator.canShare({text})===true` (test stub), **WHEN** the control is tapped, **THEN** `navigator.share` is called exactly once with `{ text: payload }` AND state goes IDLE → SHARING → SUCCESS on resolve.
- **GIVEN** `navigator.share` resolves rejected with `AbortError` (user dismissed), **WHEN** observed, **THEN** state returns to IDLE, NO error message is shown, AND `clipboard.writeText` is NOT called (no fall-through).
- **GIVEN** `navigator.share` is undefined (desktop stub), **WHEN** tapped, **THEN** `clipboard.writeText(payload)` is called exactly once AND state goes IDLE → COPYING → SUCCESS.
- **GIVEN** the payload assembler (the function that builds `payload` from `CompletedGame` + config), **WHEN** statically inspected, **THEN** it is a **pure synchronous function** — its signature returns a plain string, not a `Promise` (no `async` keyword, no awaited I/O) — so no `await` boundary can be introduced between gesture entry and the clipboard write. *(Static verification — the structural guarantee behind the iOS user-gesture requirement.)*
- **GIVEN** the tap handler with `clipboard.writeText` stubbed by a spy, **WHEN** the handler runs, **THEN** the spy is observed to have been called **before** a `Promise.resolve().then(...)` microtask scheduled at the top of the handler flushes — i.e. `writeText` is invoked in the same synchronous turn as the gesture, not after any awaited boundary. *(Runtime verification — approximate: it confirms no microtask boundary precedes the call but cannot fully reproduce iOS Safari's native user-activation gating, which only a real-device check can.)*
- **GIVEN** `clipboard.writeText` rejects with `NotAllowedError` (permission denied stub), **WHEN** observed, **THEN** state goes COPYING → FALLBACK AND a read-only textarea containing the exact payload is rendered and its text is selected.
- **GIVEN** an insecure context where `navigator.clipboard` is undefined (stub), **WHEN** tapped (and no Web Share), **THEN** state goes directly to FALLBACK without throwing.

### Feedback and UX

- **GIVEN** a successful copy/share, **WHEN** SUCCESS is entered, **THEN** the button label changes to a success state ("Copied!"/"Shared!") AND reverts to IDLE after `feedbackDurationMs` ± 200ms (verified via `vi.useFakeTimers`).
- **GIVEN** the control in SHARING or COPYING (promise in flight), **WHEN** tapped again, **THEN** the second tap is ignored (button disabled; `share`/`writeText` spy shows no second call).
- **GIVEN** the export control, **WHEN** rendered, **THEN** its hit target is ≥ 44×44px (computed style assertion in a Playwright/jsdom check).
- **GIVEN** the FALLBACK state is shown, **WHEN** rendered, **THEN** it contains a dismiss `<button>` element (not a hover-only affordance) whose hit target is ≥ 44×44px; AND **WHEN** that button is tapped, **THEN** state transitions FALLBACK → IDLE.

### Scope guards (structural / Pillar)

- **GIVEN** a game that has NOT reached a terminal state (`isTerminal` false / absent), **WHEN** the post-game screen logic runs, **THEN** the export control is not mounted/reachable (structural prevention of "export an unfinished game").
- **GIVEN** the assembled payload, **WHEN** inspected, **THEN** the system performs NO network request (no `fetch`/Supabase call) and NO persistence write during export — clipboard/share is the only sink (spy on `fetch` and any store mutation = zero-call). Anchors the v0 "pure client-side string op" rule.
- **GIVEN** the public assembler function signature, **WHEN** statically inspected, **THEN** it takes a `CompletedGame`-shaped argument (not a reference to a "current game" singleton) — ensuring Game History (MVP) can reuse it for past games.

### Size / budget (Formula verification)

- **GIVEN** a 100-move (200-ply) fixture game with the default template, **WHEN** the payload is assembled, **THEN** `estTokens` (Formula 2) is below `promptTokenBudget` (4000) AND no oversize warning is set.
- **GIVEN** a synthetic 300-move (600-ply) game exceeding `maxPlyBeforeWarn`, **WHEN** assembled, **THEN** the long-game note flag is set AND export still completes (payload produced, delivery proceeds) — never blocked.

### Real-session evidence (ADVISORY — the core quality bet)

- **GIVEN** payloads assembled from 3-5 real fixture games, **WHEN** each is pasted into a live claude.ai session during v0 build, **THEN** documented in `production/qa/evidence/` that the output reads as beginner-useful *coaching* (names opening, identifies turning points, gives a concrete next step) and not generic move narration. This is the manual validation of the systems-index High-Risk item and gates declaring the prompt template "good enough to ship."

## Open Questions

### Design questions

1. **Prompt template detail level — how prescriptive should the default be?** The "Coach" draft uses a fixed 4-item numbered ask. More structure = more consistent output but risks feeling canned across games; less structure = more natural but riskier quality. **Recommendation:** ship the structured 4-item default, then loosen only if real claude.ai sessions feel formulaic. **Owner:** Eason + Claude during v0 build. **Resolution:** via the ADVISORY real-session evidence AC.
2. **Single combined "prompt+PGN" copy vs. separate "copy PGN only":** v0 ships combined only (`copyMode` knob reserves the split). A "copy PGN only" affordance would serve players who want to import into lichess/SCID rather than Claude — but adds UI and dilutes the one-tap hook. **Recommendation:** keep v0 single-action; revisit if users ask for raw-PGN export (likely a Game History MVP concern). **Owner:** Eason. **Resolution:** after v0 user feedback.
3. **Whether to embed Post-Game Review annotations as PGN comments (`{Mistake}`) in the prompt:** richer context for Claude vs. larger payload and dependence on Review having run. `includeReviewAnnotations` knob exists but defaults off. **Owner:** Post-Game Review GDD author + this system. **Resolution:** after Post-Game Review classification vocabulary is finalized (Phase 1 late / Phase 2).
4. **"Open claude.ai ↗" link — keep, or drop as scope creep?** It's a convenience, not core, and we cannot pre-fill claude.ai's input so the player still pastes. **Recommendation:** keep (`showOpenClaudeLink` default on) — it's near-zero cost and removes one navigation step. **Owner:** Eason. **Resolution:** trivial, confirm at UX-design time.

### Cross-GDD handoff questions

5. **`CompletedGame` move encoding and exact field names** are owned by the not-yet-designed **Game Lifecycle GDD**. This system replays via `chess.js` either way, but Game Lifecycle must declare the encoding. **Anchor (recommended default):** the Chess Engine already defines `PlayResult.bestMove` as **UCI long-algebraic**, so Game Lifecycle most likely holds the move list in UCI; therefore all consumers of `CompletedGame.moves` (Export / Opening Identification / Post-Game Review) should assume **UCI** and convert to SAN via chess.js at their own boundary. Game Lifecycle stays the owner but should default to the engine's UCI output rather than a separate SAN representation. `startFen` is explicitly **out of v0 scope** (no custom starting positions in v0), so it is *not* part of this question — it becomes relevant only if a future "play from position" feature is designed. **Owner:** Game Lifecycle GDD author. **Resolution:** before v0 implementation of this system (Game Export cannot be built until Game Lifecycle exposes the completed-game object). **Blocking:** yes — this is the hard upstream dependency.
6. **Site/URL identity in PGN `Site` tag once the app is deployed:** v0 uses a local label; once a public GitHub Pages URL exists it could go in `Site`. Low priority. **Owner:** Eason. **Resolution:** at/after deployment.
