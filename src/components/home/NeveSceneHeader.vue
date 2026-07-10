<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { timeBucketForHour } from '@/lib/utils'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import { COACH_AVATAR } from '@/types/lesson'

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
  <section class="scene" :data-scene="bucket" :class="{ 'is-lit': lit }">
    <div class="scene-vignette" aria-hidden="true" />
    <div class="scene-content">
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
    </div>
  </section>
</template>

<style scoped>
.scene {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg-card, 1rem);
  padding: 22px 20px 24px;
  /* Soft radial light over a jade sky that departs from the #103029 anchor. */
  background:
    radial-gradient(120% 78% at 50% 8%, var(--scene-glow), transparent 58%),
    linear-gradient(180deg, var(--scene-sky-a) 0%, var(--scene-sky-b) 100%);
  /* Entrance: single opacity fade-up, ~620ms ease-out (atmospheric exception). */
  opacity: 0;
  transition: opacity 620ms cubic-bezier(0, 0, 0.2, 1);
}
.scene.is-lit {
  opacity: 1;
}

/* Warm-dark vignette (never pure black) to seat text and add depth. */
.scene-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    130% 120% at 50% 34%,
    transparent 52%,
    var(--scene-vignette) 100%
  );
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
