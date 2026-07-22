<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { timeBucketForHour } from '@/lib/utils'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import { COACH_AVATAR } from '@/types/lesson'
import { InkBrush } from '@/components/ui/gambit'

defineProps<{
  /** Existing time-aware greeting string — presented as Neve's spoken line. */
  greeting: string
}>()

// Sky mood follows the same hour boundaries as the greeting (utils.timeBucketForHour).
const bucket = timeBucketForHour(new Date().getHours())

// Deliberate atmospheric exception: the scene fades up once on mount (>300ms).
// prefers-reduced-motion users get it fully lit immediately (CSS media query below
// also forces opacity:1, so it is safe even if this ref never flips).
const { prefersReducedMotion } = useReducedMotion()
const lit = ref(false)
onMounted(() => {
  if (prefersReducedMotion.value) {
    lit.value = true
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(() => (lit.value = true)))
})
</script>

<template>
  <!-- Full-bleed by structural placement, not negative-margin/vw hacks: HomeView renders this
       as the first child of an unconstrained root (the max-w/px content container starts only
       after this section), and App.vue's <main> carries no top padding for the home route — so
       a plain block-level <section> already spans the viewport edge-to-edge and touches AppNav's
       bottom with zero gap. See HomeView.vue for the container split. -->
  <section class="scene" :data-scene="bucket" :class="{ 'is-lit': lit }">
    <div class="scene-content max-w-2xl md:max-w-4xl mx-auto px-[18px]">
      <div class="flex items-center gap-3">
        <img
          :src="COACH_AVATAR"
          width="40"
          height="40"
          alt="Neve"
          class="scene-avatar"
        />
        <p class="font-sans text-base font-medium text-ink-on-deep">{{ greeting }}</p>
      </div>
      <h1
        class="font-display font-bold text-[26px] md:text-[30px] leading-tight text-ink-on-deep mt-2.5"
        tabindex="-1"
      >
        棋盤未曾離開，你來了。
      </h1>
      <!-- 招呼語墨筆：深青底＝跟著表面走的暖白墨（兩主題皆同，見 scoped --color-ink-brush 覆寫），
           不跟隨 noir 主題切換成深棕墨（全域 token 的預設行為在深色底上會消失）。 -->
      <div class="mt-1.5" aria-hidden="true">
        <InkBrush :width="150" :height="12" :seed="2" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.scene {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding: 26px 0 96px;
  /* 墨韻母題「跟著表面走，不跟主題走」：此表面兩主題皆是深青／深墨綠，墨色固定用暖白墨。 */
  --color-ink-brush: rgba(236, 230, 218, 0.72);
  /* Sky = the page's own atmosphere, not a card: nav-join anchors the top edge to AppNav's
     bottom colour (#183E35, no jump), sky-a/sky-b carry the time-of-day temperature. The colour
     transition is compressed into the top 40% of the band and sky-b holds solid for the rest —
     a long fade down to the cream content colour banded visibly on iPhone displays, so the
     bottom edge cuts straight to cream instead, with a hairline inset shadow standing in for
     the soft edge a fade used to provide. */
  background:
    radial-gradient(120% 70% at 50% 6%, var(--scene-glow), transparent 55%),
    linear-gradient(
      180deg,
      var(--scene-nav-join) 0%,
      var(--scene-sky-a) 16%,
      var(--scene-sky-b) 40%,
      var(--scene-sky-b) 100%
    );
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.22);
  /* Entrance: single opacity fade-up, ~620ms ease-out (atmospheric exception). */
  opacity: 0;
  transition: opacity 620ms cubic-bezier(0, 0, 0.2, 1);
}
.scene.is-lit {
  opacity: 1;
}

@media (min-width: 768px) {
  .scene {
    padding: 34px 0 120px;
  }
}

.scene-content {
  position: relative;
  z-index: 1;
}

.scene-avatar {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  object-fit: cover;
  border: 1px solid rgba(231, 241, 236, 0.28);
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .scene {
    opacity: 1;
    transition: none;
  }
}
</style>
