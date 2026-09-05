<script setup lang="ts">
/**
 * 深化收尾彈窗，共用於 ConceptDeepenView（lesson-only 概念）與 RecognitionFieldView（有判斷場的
 * 概念）——兩者都是深化流程的終點頁，收尾卡片與 focus trap 邏輯本是同一份，2026-08-03 判斷場搬遷
 * 拆路由時抽出以免複製。棋盤留在後面（非整頁切換），故本元件不遮蓋呼叫端的棋盤內容。
 */
import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-vue-next'

defineProps<{ title: string; essence: string }>()
const emit = defineEmits<{ close: [] }>()

const wrapOverlay = ref<HTMLElement | null>(null)
// a11y: move focus into the dialog (aria-modal needs focus inside; Esc / scrim-click then dismiss).
// The parent mounts this component fresh via v-if, so onMounted already fires after this element
// commits — no extra nextTick needed (unlike the pre-migration version, which called this from a
// synchronous handler in the SAME tick as the v-if flip).
onMounted(() => wrapOverlay.value?.focus())

// Minimal focus trap for this self-authored wrap-up dialog. We keep the bespoke overlay (rather than
// swapping in the shared ui/dialog) to preserve the wrap-fade spring entrance + custom essence card —
// DialogContent would replace them with its own zoom-in animation and inject an X-close button. So the
// trap is hand-rolled: Esc/scrim dismiss stay, and Tab/Shift+Tab cycle within the overlay so keyboard
// focus can't slip behind the modal (aria-modal already hides the rest from AT).
function onWrapKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key !== 'Tab') return
  const root = wrapOverlay.value
  if (!root) return
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  )
  if (focusables.length === 0) { e.preventDefault(); return }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (e.shiftKey) {
    if (active === first || active === root) { e.preventDefault(); last.focus() }
  } else if (active === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Transition name="wrap-fade" appear>
    <div
      ref="wrapOverlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,24,18,0.55)] p-6"
      role="dialog"
      aria-modal="true"
      aria-label="深化完成"
      tabindex="-1"
      @keydown="onWrapKeydown"
      @click.self="emit('close')"
    >
      <div
        data-testid="deepening-wrapup-completion"
        class="wrap-card relative flex w-full max-w-sm flex-col items-center rounded-[18px] bg-surface-card px-6 py-7 text-center shadow-[0_12px_40px_rgba(8,24,18,0.4)]"
      >
        <p class="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">· 深化完成 ·</p>
        <p class="font-display text-xl font-bold text-ink">{{ title }}</p>

        <div class="my-4 flex w-full items-center gap-2 px-1" aria-hidden="true">
          <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
          <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
          <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
        </div>

        <!-- 精髓：這個戰術濃縮成一句，讓人離開前再回味一次 -->
        <p class="w-full font-lesson text-[16px] leading-relaxed text-ink">{{ essence }}</p>

        <Button
          variant="gold"
          class="mt-6 w-full justify-center text-sm"
          data-testid="deepening-wrapup-return"
          @click="emit('close')"
        >回棋理地圖 <ArrowRight :size="16" :stroke-width="1.8" /></Button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 收尾卡入場：fade + 微升 + scale（落定感），尊重 reduced-motion。 */
.wrap-fade-enter-active { transition: opacity 0.25s ease; }
.wrap-fade-enter-from { opacity: 0; }
.wrap-fade-enter-active .wrap-card {
  animation: wrap-card-in 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes wrap-card-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .wrap-fade-enter-active, .wrap-fade-enter-active .wrap-card { transition: none; animation: none; }
}
</style>
