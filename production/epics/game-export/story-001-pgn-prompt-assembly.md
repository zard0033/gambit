# Story 001: PGN Serialization and Claude.ai Prompt Assembly

> **Epic**: Game Export / Share
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-game-export-001, TR-game-export-004
> **ADR**: ADR-0005, ADR-0010

## Context

**GDD**: `design/gdd/game-export-share.md`
**Requirements**: `TR-game-export-001`, `TR-game-export-004`

**ADR Governing Implementation**: ADR-0010: Game Export Tier-1/2/3 Delivery and Sync-Gesture Clipboard Contract
**ADR Decision Summary**: `assembleExportPayload(game, config): string` is PURE SYNCHRONOUS — `string` return type (not `Promise<string>`), no `async`, no `await`. `ExportConfig` fields use `readonly` modifiers. PGN via `chess.js .pgn()` with Seven Tag Roster headers. Claude.ai prompt template is deterministic given the same inputs.

**Control Manifest Rules (Feature layer)**:
- Required: `assembleExportPayload(game, config): string` MUST be pure synchronous — no `async`, return type `string` not `Promise<string>`
- Required: `ExportConfig` fields use `readonly` modifiers; accept a frozen `CompletedGame`
- Forbidden: Never call `fetch`, `supabase`, or `sessionStorage` from `src/modules/game-export/`
- Forbidden: Never pre-build export payload on mount and read at tap time

---

## Acceptance Criteria

- [x] `assembleExportPayload(game: CompletedGame, config: ExportConfig): string` is a pure synchronous function — no `async` keyword, return type `string`.
- [x] PGN output includes the Seven Tag Roster: Event, Site, Date, Round, White, Black, Result.
- [x] PGN round-trips correctly: the output string can be loaded back into `chess.js` without error.
- [x] Claude.ai prompt template is deterministic: same `CompletedGame` + same `ExportConfig` always produces the same output.
- [x] `ExportConfig` uses `readonly` on all fields.
- [x] TypeScript: assigning the return value to a `Promise<string>` variable is a compile error (type safety).
- [x] Static grep confirms no `fetch`, `supabase`, or `sessionStorage` in `src/modules/game-export/`.

---

## Implementation Notes

*From ADR-0010 §1:*

```ts
// src/modules/game-export/types.ts
export interface ExportConfig {
  readonly playerName: string
  readonly aiSkillLevel: number
  readonly includeAnnotations: boolean
}

// src/modules/game-export/assembler.ts
export function assembleExportPayload(game: CompletedGame, config: ExportConfig): string {
  const chess = new Chess()
  for (const move of game.moves) chess.move(move)

  const pgn = chess.pgn({
    headers: {
      Event: 'Chess Training Companion',
      Site: 'https://chess-training.app',
      Date: new Date(game.completedAt).toISOString().split('T')[0].replace(/-/g, '.'),
      Round: '-',
      White: game.playerColor === 'white' ? config.playerName : 'Stockfish',
      Black: game.playerColor === 'black' ? config.playerName : 'Stockfish',
      Result: game.result
    }
  })

  return [
    `Here is my chess game for analysis:`,
    ``,
    `\`\`\`pgn`,
    pgn,
    `\`\`\``,
    ``,
    `Please review my moves and identify my biggest mistakes and what I should have played instead.`
  ].join('\n')
}
```

- The prompt template is a constant string format — no external data fetched.
- Replay via `chess.move(move)` reuses the `CompletedGame.moves` UCI string array.

---

## QA Test Cases

- **AC-1**: Pure synchronous return
  - When: TypeScript checks `const p: Promise<string> = assembleExportPayload(game, config)`
  - Then: compile error: `Type 'string' is not assignable to type 'Promise<string>'`

- **AC-2**: PGN round-trips
  - Given: `assembleExportPayload(game, config)` output
  - When: extract PGN block and `new Chess().loadPgn(pgn)`
  - Then: no error thrown; `chess.history().length === game.moves.length`

- **AC-3**: Seven Tag Roster present
  - Given: PGN output string
  - When: parse headers
  - Then: all 7 tags present: `[Event "..."]`, `[Site "..."]`, `[Date "..."]`, `[Round "..."]`, `[White "..."]`, `[Black "..."]`, `[Result "..."]`

- **AC-4**: Determinism
  - Given: same `game` object called twice
  - When: `assembleExportPayload(game, config)` called twice
  - Then: both outputs are identical strings

- **AC-5**: No forbidden imports
  - When: `grep -r "fetch\|supabase\|sessionStorage" src/modules/game-export/`
  - Then: 0 matches

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/game-export/pgn-prompt-assembly.test.ts`

**Status**: [x] `tests/unit/game-export/pgn-prompt-assembly.test.ts` — 14 tests, all pass (2026-05-30)

---

## Dependencies

- Depends on: Epic game-lifecycle Story 002 (CompletedGame type defined)
- Unlocks: Story 002 (assembler is called synchronously before clipboard write)
