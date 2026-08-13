# Gambit

[English](README.md) · [繁體中文](README.zh-TW.md)

**Live demo:** [zard0033.github.io/gambit](https://zard0033.github.io/gambit/). Sign in with Google or continue as guest.

A single-player chess training app I built and use myself: play against Stockfish, get a two-pass post-game review, then drill on exactly the moments you missed, presented as blind puzzles that don't tell you upfront whether there's anything there.

It has one user. That's not a caveat, it's the constraint I built around. I only ever had to be right for myself, so when my own usage told me my product thesis was wrong, I could act on it instead of defending a roadmap to anyone else.

**That's the real subject of this repo.** In August 2026 I tested my own positioning doc against actual engine data, found two of its three central claims didn't hold, and deleted roughly 33,000 lines (code, tests, and planning docs together) over the following week. [How that happened →](#the-call-i-reversed-on-myself)

---

## The call I reversed on myself

The first version of this product's positioning made three claims I had never tested:

1. The app had no way to train players to *notice* a missed tactic: a whole learning stage was missing.
2. A specific engine signal (the gap between the best and second-best move, ≥150 centipawns) reliably flagged "there's a tactic here."
3. The app's biggest structural problem was a "three-layer" architecture, and fixing it was the priority.

I checked all three against the code and against real engine output instead of trusting the argument.

- **Claim 1 was just wrong.** The "notice" stage already existed. I'd misread my own codebase.
- **Claim 2 didn't survive contact with data.** I instrumented Stockfish's MultiPV output across real games. Across four seeded runs, the ≥150cp signal fired in only 7-30% of turns overall, and in one full game it fired **zero times** across the 17 opening/mid-game turns where it was supposed to matter. The few times it did fire were consecutive endgame turns that already had a forced mate on the board. The signal doesn't measure "is there a tactic here," it measures "is the best move unique," and those two things are nearly opposite exactly where the game gets interesting.
- **Claim 3 was directionally right but tiny.** Followed all the way through, the "three-layer" argument only justified deleting 0.65% of the source tree, not the structural fix it was framed as.

Full writeup, the falsifiable predictions I wrote down afterward (with dates, so I can't quietly move the goalposts), and the decision log: [`production/positioning-v2-2026-08-02.md`](production/positioning-v2-2026-08-02.md)

What I did about it, over the following week:

| Commit | Cut | Lines removed |
| --- | --- | --- |
| [`607aba9`](https://github.com/zard0033/gambit/commit/607aba9) | Rewrote the product thesis; removed the process docs and speculative planning content that had piled up around the old one | 25,736 (245 files) |
| [`b6ed26c`](https://github.com/zard0033/gambit/commit/b6ed26c) | A journaling feature whose four completion gates never once read the board state | 3,406 (62 files) |
| [`7b1223`](https://github.com/zard0033/gambit/commit/7b1223) | A gamified level-map-and-lock shell built to deliver 30 puzzle positions | 1,195 (38 files) |
| [`e2cb898`](https://github.com/zard0033/gambit/commit/e2cb898) | A slideshow/replay narrative UI wrapped around post-game review | 2,730 (45 files) |

*(Deletion counts are from `git show --stat` on each commit; every commit also touched a small number of lines for renames and config. See the linked commit for the full diff.)*

Four commits, five days, one rewritten thesis. What survived is one loop: play → two-pass review → find what you missed → drill it blind → play again.

---

## What it does

- **Play against Stockfish 18** (WASM, runs entirely client-side, no server round-trip per move), with tunable difficulty
- **Post-game review** in two passes, walking through what you played versus what was best, move by move
- **Blind tactics drills**: puzzles built from your own missed forced wins, mixed with decoys that don't announce whether there's an answer
- **30 curated tactics puzzles** for deliberate practice outside your own games
- **Game export**: one tap to copy a game as PGN plus a ready-to-paste prompt, for taking a position to an AI or a stronger player to discuss
- **Installable PWA** with offline support after first load; Google OAuth or guest mode, synced through Supabase

## Why it exists

Two goals, and I'm not going to pretend they're the same one:

- **(A) Get better at chess.** By that measure, the time spent building this has been a net loss: the same hours on lichess puzzles and real games would almost certainly move my rating further. This app has a few dozen curated positions where lichess has hundreds of thousands.
- **(B) Have an engineering project worth doing.** This is the goal my behavior reveals: zero real users, 15,000+ lines of TypeScript and Vue written anyway. It's a legitimate goal on its own. It just has to be named honestly instead of laundered through "this helps me learn chess" every time a feature gets scoped.

The full reasoning, including the predictions I'm holding myself to, lives in [`production/positioning-v2-2026-08-02.md`](production/positioning-v2-2026-08-02.md).

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | Vue 3 (Composition API) + Vue Router + Pinia |
| Language / build | TypeScript + Vite |
| Styling | Tailwind CSS + reka-ui (shadcn pattern) |
| Board | vue3-chessboard (chessground) + chess.js |
| Engine | Stockfish 18 Lite (single-threaded WASM, NNUE), runs in a Web Worker |
| Backend | Supabase (PostgreSQL + Google OAuth) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Deployment | GitHub Pages, via GitHub Actions |

## Running it locally

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + production build
npm run test       # unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
npm run typecheck  # type check only
```

Requires Node 26+. The Supabase client is created at import time and needs a native WebSocket implementation that older Node versions don't have.

## Repo stats

Numbers I can point at, not estimates:

- 318 commits, February to August 2026
- 80 test files (unit + E2E)
- ~15,650 lines of application source (`src/`) as of the last commit

## License

MIT. See [`LICENSE`](LICENSE) for the full text. This repo started as a fork of [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios); the agent/skill tooling under `.claude/` traces back to that template.
