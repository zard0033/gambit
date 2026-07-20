import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MissedMate, MissedMateSource } from '@/modules/learning-loop/missed-mate'
import type { MissedMaterial, MissedMaterialSource } from '@/modules/learning-loop/missed-material'
import {
  RECOGNITION_SOURCE_MAX,
  RECOGNITION_CONSUMED_MAX,
  RECOGNITION_SOURCE_GAMES_MAX,
  RECOGNITION_MISSED_MATE_ENABLED,
  RECOGNITION_MISSED_MATERIAL_ENABLED,
} from '@/config/learning-loop-tuning'

const STORAGE_KEY = 'pgr:recognition:sources'

interface PersistShape {
  sources: MissedMateSource[]
  /** Parallel to `sources` (Eason-approved, 2026-07-12 §5 Q2) — kept separate, not merged into a
   *  generalized shape, so the already-shipped `sources`/`captureMate`/`pendingFor('mate')` v1
   *  contract needs zero changes. */
  materialSources: MissedMaterialSource[]
  consumed: string[]
}

const idOf = (s: { gameId: string; ply: number }): string => `${s.gameId}:${s.ply}`

/** Read persisted state. Corrupt/absent → empty; the store must never throw (mirrors concept-progress). */
function load(): PersistShape {
  const empty: PersistShape = { sources: [], materialSources: [], consumed: [] }
  if (typeof localStorage === 'undefined') return empty
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw) as Partial<PersistShape>
    const sources = Array.isArray(parsed?.sources)
      ? parsed.sources.filter(
          (s): s is MissedMateSource =>
            !!s &&
            typeof s.gameId === 'string' &&
            typeof s.ply === 'number' &&
            typeof s.fen === 'string' &&
            typeof s.mateMoveUci === 'string' &&
            (s.playerColor === 'white' || s.playerColor === 'black'),
        )
      : []
    // Absent in pre-v2 localStorage (field didn't exist yet) → [] (backward-compatible default).
    const materialSources = Array.isArray(parsed?.materialSources)
      ? parsed.materialSources.filter(
          (s): s is MissedMaterialSource =>
            !!s &&
            typeof s.gameId === 'string' &&
            typeof s.ply === 'number' &&
            typeof s.fen === 'string' &&
            typeof s.captureMoveUci === 'string' &&
            (s.playerColor === 'white' || s.playerColor === 'black'),
        )
      : []
    const consumed = Array.isArray(parsed?.consumed)
      ? parsed.consumed.filter((c): c is string => typeof c === 'string')
      : []
    return { sources, materialSources, consumed }
  } catch {
    return empty
  }
}

/**
 * Recognition-source store (棋憶 signpost → RecognitionGate; v1: mate, v2: + material offense). Holds
 * missed-mate/missed-material positions captured at review COMPLETE and drives the deepening page's
 * real-board judgement field. Idempotent by `gameId:ply`; consumed ids are excluded so a solved
 * position never resurfaces. mate and material are PARALLEL arrays with parallel methods
 * (`sources`/`captureMate`/`pendingFor('mate')` vs `materialSources`/`captureMaterial`/
 * `pendingFor('material')`) — Eason-approved (2026-07-12 §5 Q2) to keep the v1 mate contract untouched.
 */
export const useRecognitionSourceStore = defineStore('recognitionSource', () => {
  const initial = load()
  const sources = ref<MissedMateSource[]>(initial.sources)
  const materialSources = ref<MissedMaterialSource[]>(initial.materialSources)
  const consumed = ref<Set<string>>(new Set(initial.consumed))

  function persist(): void {
    if (typeof localStorage === 'undefined') return
    const payload: PersistShape = {
      sources: sources.value,
      materialSources: materialSources.value,
      consumed: [...consumed.value],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  /**
   * Capture the missed mates of one game. Idempotent: skips ids already stored or already consumed,
   * so re-reviewing the same game never double-inserts (dedup keyed `gameId:ply`). After inserting,
   * trims `sources` down to the `RECOGNITION_SOURCE_GAMES_MAX` most-recently-written distinct games —
   * unconsumed entries from older games are dead weight (`pendingFor` only ever serves the latest
   * game) and would otherwise grow localStorage without bound.
   */
  function captureMate(gameId: string, playerColor: 'white' | 'black', mates: MissedMate[]): void {
    let changed = false
    for (const m of mates) {
      const id = `${gameId}:${m.ply}`
      if (consumed.value.has(id)) continue
      if (sources.value.some((s) => idOf(s) === id)) continue
      sources.value.push({ gameId, ply: m.ply, fen: m.fen, mateMoveUci: m.mateMoveUci, playerColor })
      changed = true
    }
    if (changed) {
      const gameIdsInWriteOrder: string[] = []
      for (const s of sources.value) {
        if (!gameIdsInWriteOrder.includes(s.gameId)) gameIdsInWriteOrder.push(s.gameId)
      }
      if (gameIdsInWriteOrder.length > RECOGNITION_SOURCE_GAMES_MAX) {
        const keep = new Set(gameIdsInWriteOrder.slice(-RECOGNITION_SOURCE_GAMES_MAX))
        sources.value = sources.value.filter((s) => keep.has(s.gameId))
      } else {
        sources.value = [...sources.value] // new ref so computed deps re-run
      }
      persist()
    }
  }

  /**
   * Unconsumed sources for a concept, from the most recent game only (the latest still-pending game
   * in insertion order), capped at `RECOGNITION_SOURCE_MAX`. Two branches: 'material' (new, its own
   * kill switch) and 'mate' (v1, UNCHANGED — same lines that ran before this branch existed). Any
   * other conceptId stays the v1 empty-array default.
   */
  function pendingFor(conceptId: string): ReadonlyArray<MissedMateSource | MissedMaterialSource> {
    if (conceptId === 'material') {
      if (!RECOGNITION_MISSED_MATERIAL_ENABLED) return []
      const unconsumedMaterial = materialSources.value.filter((s) => !consumed.value.has(idOf(s)))
      if (unconsumedMaterial.length === 0) return []
      const latestMaterialGameId = unconsumedMaterial[unconsumedMaterial.length - 1].gameId
      return unconsumedMaterial
        .filter((s) => s.gameId === latestMaterialGameId)
        .slice(0, RECOGNITION_SOURCE_MAX)
    }
    if (!RECOGNITION_MISSED_MATE_ENABLED) return []
    if (conceptId !== 'mate') return []
    const unconsumed = sources.value.filter((s) => !consumed.value.has(idOf(s)))
    if (unconsumed.length === 0) return []
    const latestGameId = unconsumed[unconsumed.length - 1].gameId
    return unconsumed.filter((s) => s.gameId === latestGameId).slice(0, RECOGNITION_SOURCE_MAX)
  }

  /**
   * Whether a concept has any pending judgement-field source (drives the signpost's visibility).
   * Kill switch: false whenever `RECOGNITION_MISSED_MATE_ENABLED` is false (delegates to `pendingFor`).
   */
  function hasPending(conceptId: string): boolean {
    return pendingFor(conceptId).length > 0
  }

  /**
   * Capture the missed material of one game (parallel to `captureMate` — same idempotency/dedup/trim
   * shape, own array, own gameIds-in-write-order trim). New method (Eason-approved §5 Q2); does not
   * touch `captureMate` or `sources`.
   */
  function captureMaterial(
    gameId: string,
    playerColor: 'white' | 'black',
    materials: MissedMaterial[],
  ): void {
    let changed = false
    for (const m of materials) {
      const id = `${gameId}:${m.ply}`
      if (consumed.value.has(id)) continue
      if (materialSources.value.some((s) => idOf(s) === id)) continue
      materialSources.value.push({
        gameId,
        ply: m.ply,
        fen: m.fen,
        captureMoveUci: m.captureMoveUci,
        playerColor,
      })
      changed = true
    }
    if (changed) {
      const gameIdsInWriteOrder: string[] = []
      for (const s of materialSources.value) {
        if (!gameIdsInWriteOrder.includes(s.gameId)) gameIdsInWriteOrder.push(s.gameId)
      }
      if (gameIdsInWriteOrder.length > RECOGNITION_SOURCE_GAMES_MAX) {
        const keep = new Set(gameIdsInWriteOrder.slice(-RECOGNITION_SOURCE_GAMES_MAX))
        materialSources.value = materialSources.value.filter((s) => keep.has(s.gameId))
      } else {
        materialSources.value = [...materialSources.value] // new ref so computed deps re-run
      }
      persist()
    }
  }

  /**
   * Mark sources (by `gameId:ply` id) consumed so they never resurface. Persists. Also drops the
   * now-consumed entries from `sources` AND `materialSources` (both share the same consumed-id
   * namespace; only-grows would slowly leak localStorage) and FIFO-trims `consumed` at
   * `RECOGNITION_CONSUMED_MAX` — the dedup guard in `captureMate`/`captureMaterial` only needs recent
   * history, not the full lifetime list.
   */
  function markConsumed(ids: string[]): void {
    let changed = false
    for (const id of ids) {
      if (!consumed.value.has(id)) {
        consumed.value.add(id)
        changed = true
      }
    }
    if (changed) {
      let next = consumed.value
      if (next.size > RECOGNITION_CONSUMED_MAX) {
        next = new Set([...next].slice(next.size - RECOGNITION_CONSUMED_MAX))
      }
      consumed.value = next
      sources.value = sources.value.filter((s) => !consumed.value.has(idOf(s)))
      materialSources.value = materialSources.value.filter((s) => !consumed.value.has(idOf(s)))
      persist()
    }
  }

  return {
    sources,
    materialSources,
    consumed,
    captureMate,
    captureMaterial,
    pendingFor,
    hasPending,
    markConsumed,
  }
})
