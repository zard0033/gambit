# Story 002: Tier-1/2/3 Clipboard Delivery State Machine

> **Epic**: Game Export / Share
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-game-export-002, TR-game-export-003
> **ADR**: ADR-0005, ADR-0010

## Context

**GDD**: `design/gdd/game-export-share.md`
**Requirements**: `TR-game-export-002`, `TR-game-export-003`

**ADR Governing Implementation**: ADR-0010: Game Export Tier-1/2/3 Delivery and Sync-Gesture Clipboard Contract
**ADR Decision Summary**: State machine: IDLE → SHARING/COPYING → SUCCESS → FALLBACK. Tier decision made synchronously in tap handler BEFORE any `await`. iOS: `navigator.share()` is one-shot — AbortError → IDLE; any other rejection → FALLBACK. `clipboardWriteText()` must be called synchronously inside tap handler (no `await` before it). FALLBACK: `v-if` textarea, auto-selects on mount.

**Control Manifest Rules (Feature layer)**:
- Required: Tier decision MUST be made synchronously inside tap handler BEFORE any `await`
- Required: `canShare({ text: payload })` probe MUST use exactly the `{ text }` shape that `share()` will use
- Required: `useGameExport` is a Vue composable, NOT a Pinia store; timers cleared via `onScopeDispose`
- Required: FALLBACK textarea rendered via `v-if`; `nextTick(() => el.select())` on mount
- Required: FALLBACK dismiss is a real `<button>` element, ≥ 44×44px
- Required: Button `:disabled="state === 'SHARING' || state === 'COPYING'"` for in-flight suppression
- Forbidden: Never call clipboard write after `navigator.share()` rejects on iOS (gesture spent)
- Forbidden: Never auto-trigger or auto-navigate after export success (Pillar 3: No Pressure)

---

## Acceptance Criteria

- [x] The "Analyze with Claude" button tap handler calls `assembleExportPayload()` synchronously then immediately decides tier — no `await` before the tier decision.
- [x] Tier-1 (Web Share): if `navigator.canShare({ text: payload })` → `navigator.share({ text: payload })`.
- [x] Tier-2 (Clipboard): if `canShare` false or unavailable → `navigator.clipboard.writeText(payload)`.
- [x] Tier-3 (FALLBACK): if Clipboard `NotAllowedError` or share non-AbortError → render FALLBACK textarea.
- [x] AbortError from `navigator.share()` → return to IDLE (user dismissed share sheet — NOT a failure).
- [x] FALLBACK textarea: v-if pattern; `dismissFallback()` resets to IDLE.
- [x] Button is `:disabled` while state is SHARING or COPYING (in-flight tap suppression).
- [x] Static verification: `assembleExportPayload` call appears before first `await` in handler.

---

## Implementation Notes

*From ADR-0010 §2–§4 + §6:*

```ts
// src/modules/game-export/use-game-export.ts (composable, NOT Pinia store)
export function useGameExport() {
  const state = ref<'IDLE' | 'SHARING' | 'COPYING' | 'SUCCESS' | 'FALLBACK'>('IDLE')
  const fallbackText = ref('')

  async function onExportTap() {
    const payload = assembleExportPayload(game, config)  // sync — no await before this

    // Tier decision: synchronous
    if (navigator.share && navigator.canShare({ text: payload })) {
      state.value = 'SHARING'
      try {
        await navigator.share({ text: payload })
        state.value = 'SUCCESS'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          state.value = 'IDLE'  // user dismissed — not an error
        } else {
          fallbackText.value = payload
          state.value = 'FALLBACK'
        }
      }
    } else if (navigator.clipboard) {
      state.value = 'COPYING'
      try {
        await navigator.clipboard.writeText(payload)
        state.value = 'SUCCESS'
      } catch {
        fallbackText.value = payload
        state.value = 'FALLBACK'
      }
    } else {
      fallbackText.value = payload
      state.value = 'FALLBACK'
    }
  }

  onScopeDispose(() => { /* clear any pending timers */ })

  return { state, fallbackText, onExportTap }
}
```

- FALLBACK textarea: `<textarea v-if="state === 'FALLBACK'" :value="fallbackText" ref="textareaRef" readonly />` with `onMounted(() => nextTick(() => textareaRef.value?.select()))`.
- FALLBACK dismiss button: `<button @click="state = 'IDLE'" style="min-width:44px;min-height:44px">Close</button>`.
- ⚠️ iOS: no `await` before `share()` call. The `assembleExportPayload()` call happens first (sync), tier decision happens (sync), then `await navigator.share(...)`. The await is AFTER the share call — this preserves the user gesture context.

---

## QA Test Cases

- **AC-1**: Tier-1 share → SUCCESS
  - Given: mock `navigator.share` resolves; `navigator.canShare({ text: '...' })` returns true
  - When: `onExportTap()` called
  - Then: state sequence: IDLE → SHARING → SUCCESS; `navigator.share` called with `{ text: payload }`

- **AC-2**: AbortError → IDLE (not FALLBACK)
  - Given: mock `navigator.share` rejects with `new DOMException('AbortError', 'AbortError')`
  - When: `onExportTap()` called
  - Then: state → IDLE (not FALLBACK); FALLBACK textarea not rendered

- **AC-3**: Non-AbortError share rejection → FALLBACK
  - Given: mock `navigator.share` rejects with `new Error('SystemError')`
  - When: `onExportTap()` called
  - Then: state → FALLBACK; textarea rendered with `fallbackText === payload`

- **AC-4**: Clipboard NotAllowedError → FALLBACK
  - Given: `navigator.share` unavailable; mock `clipboard.writeText` rejects with `NotAllowedError`
  - When: `onExportTap()` called
  - Then: state → FALLBACK

- **AC-5**: In-flight tap suppression
  - Given: state === 'SHARING'
  - When: check button's `disabled` attribute
  - Then: `button.disabled === true`

- **AC-6**: No await before tier decision (static check)
  - When: grep `use-game-export.ts` for `await` before `assembleExportPayload` call
  - Then: 0 matches (assembleExportPayload called before any await in the handler)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/game-export/tier-delivery.test.ts`

**Status**: [x] `tests/unit/game-export/tier-delivery.test.ts` — 13 tests, all pass（原記 11 tests／2026-05-30；2026-07-13 複驗）

---

## Dependencies

- Depends on: Story 001 must be DONE (`assembleExportPayload` exists)
- Unlocks: Nothing — terminal feature story
