<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { timeBucketForHour } from '@/lib/utils'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import { COACH_AVATAR } from '@/types/lesson'
import { Button } from '@/components/ui/button'

/** The "繼續走" station — an action (game logic), not a plain navigation. */
export interface CtaStation {
  headline: string
  meta: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

/** The "學習" / "試煉" stations — pure navigation. */
export interface PathStation {
  title: string
  sub: string
  to: string
}

defineProps<{
  /** Existing time-aware greeting string — presented as Neve's spoken line. */
  greeting: string
  cta: CtaStation
  lesson: PathStation
  trial: PathStation
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

// Fixed decorative star field — deterministic (no Math.random) so the scene renders
// identically every mount and in screenshot diffs. Positions/sizes/opacity are hand-picked
// from the approved concept sample (concept-round/home-a-v4.html).
const stars = [
  { l: 88.6, t: 50.7, s: 2.23, o: 0.67 }, { l: 56.2, t: 44.7, s: 1.65, o: 0.28 },
  { l: 70.3, t: 48.4, s: 1.84, o: 0.43 }, { l: 74.1, t: 58.8, s: 2.29, o: 0.74 },
  { l: 18.3, t: 8.4, s: 1.75, o: 0.71 }, { l: 16.3, t: 27.4, s: 1.2, o: 0.52 },
  { l: 67.1, t: 2.5, s: 1.57, o: 0.67 }, { l: 43.3, t: 45.5, s: 0.89, o: 0.75 },
  { l: 47.5, t: 10.9, s: 2.1, o: 0.35 }, { l: 34.1, t: 47.3, s: 1.15, o: 0.27 },
  { l: 98.0, t: 11.5, s: 1.76, o: 0.77 }, { l: 30.6, t: 40.4, s: 0.82, o: 0.28 },
  { l: 41.8, t: 48.5, s: 2.1, o: 0.46 }, { l: 48.9, t: 9.6, s: 2.21, o: 0.59 },
  { l: 32.2, t: 33.2, s: 1.6, o: 0.69 }, { l: 57.0, t: 47.4, s: 2.27, o: 0.5 },
  { l: 62.9, t: 19.2, s: 1.71, o: 0.57 }, { l: 18.9, t: 30.5, s: 0.73, o: 0.27 },
  { l: 46.2, t: 23.3, s: 1.14, o: 0.78 }, { l: 6.4, t: 19.6, s: 1.33, o: 0.53 },
  { l: 57.6, t: 11.8, s: 0.86, o: 0.51 }, { l: 76.2, t: 17.6, s: 1.37, o: 0.54 },
  { l: 46.3, t: 52.1, s: 2.14, o: 0.28 }, { l: 14.7, t: 18.3, s: 1.47, o: 0.67 },
  { l: 13.6, t: 9.5, s: 0.84, o: 0.71 }, { l: 49.1, t: 34.2, s: 1.99, o: 0.75 },
  { l: 57.0, t: 29.5, s: 2.02, o: 0.56 }, { l: 25.0, t: 40.6, s: 2.2, o: 0.55 },
  { l: 81.5, t: 7.0, s: 1.97, o: 0.65 }, { l: 51.2, t: 24.5, s: 1.97, o: 0.55 },
  { l: 77.2, t: 28.0, s: 1.72, o: 0.44 }, { l: 10.3, t: 12.0, s: 1.53, o: 0.34 },
  { l: 63.9, t: 44.8, s: 0.81, o: 0.46 }, { l: 36.8, t: 13.0, s: 2.07, o: 0.73 },
  { l: 2.0, t: 28.5, s: 1.74, o: 0.75 }, { l: 61.7, t: 7.7, s: 1.18, o: 0.66 },
  { l: 70.5, t: 37.2, s: 1.12, o: 0.7 }, { l: 23.3, t: 35.8, s: 2.08, o: 0.59 },
  { l: 11.5, t: 16.5, s: 0.95, o: 0.41 }, { l: 44.9, t: 17.7, s: 1.53, o: 0.7 },
  { l: 40.9, t: 13.2, s: 1.99, o: 0.77 }, { l: 79.7, t: 50.6, s: 1.21, o: 0.63 },
]
</script>

<template>
  <!-- Full-bleed by structural placement, not negative-margin/vw hacks: HomeView renders this
       as the first child of an unconstrained root (the max-w/px content container starts only
       after this section), and App.vue's <main> carries no top padding for the home route — so
       a plain block-level <section> already spans the viewport edge-to-edge and touches AppNav's
       bottom with zero gap. See HomeView.vue for the container split. -->
  <section class="scene" :data-scene="bucket" :class="{ 'is-lit': lit }">
    <div class="atmo" aria-hidden="true">
      <div class="streak s1"></div>
      <div class="streak s2"></div>
      <div class="core"></div>
    </div>
    <div class="stardust" aria-hidden="true">
      <span
        v-for="(star, i) in stars"
        :key="i"
        class="star"
        :style="{ left: `${star.l}%`, top: `${star.t}%`, width: `${star.s}px`, height: `${star.s}px`, opacity: star.o }"
      />
    </div>
    <div class="grain" aria-hidden="true"></div>

    <div class="scene-content max-w-2xl md:max-w-4xl mx-auto px-[18px]">
      <div class="flex items-center gap-3">
        <img :src="COACH_AVATAR" width="40" height="40" alt="Neve" class="scene-avatar" />
        <p class="font-sans text-base font-medium scene-ink">{{ greeting }}</p>
      </div>
      <h1
        class="font-display font-bold text-[26px] md:text-[30px] leading-tight scene-ink mt-2.5 max-w-[16ch]"
        tabindex="-1"
      >
        棋盤未曾離開，你來了。
      </h1>

      <!-- 蜿蜒小徑：三段貝茲曲線 + 三站光點（幾何／層級定義見 design/quick-specs/home-scene-redesign.md）。 -->
      <div class="path-wrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="curve" d="M12,10 C42,18 30,32 44,42 C58,52 12,66 20,80" />
        </svg>

        <div class="node node-cta">
          <span class="dot" aria-hidden="true"></span>
          <div class="body">
            <div class="label">繼續走</div>
            <p class="title">{{ cta.headline }}</p>
            <p class="sub">{{ cta.meta }}</p>
            <div class="cta-row">
              <Button variant="gold" size="sm" class="cta-btn" @click="cta.onPrimary">
                {{ cta.primaryLabel }}
              </Button>
            </div>
            <button
              v-if="cta.secondaryLabel"
              type="button"
              class="secondary-link"
              @click="cta.onSecondary?.()"
            >{{ cta.secondaryLabel }}</button>
          </div>
        </div>

        <RouterLink :to="lesson.to" class="node node-lesson" aria-label="學習">
          <span class="dot" aria-hidden="true"></span>
          <div class="body">
            <div class="label">學習</div>
            <p class="title">{{ lesson.title }}</p>
            <p class="sub">{{ lesson.sub }}</p>
          </div>
        </RouterLink>

        <RouterLink :to="trial.to" class="node node-trial" aria-label="試煉">
          <span class="dot" aria-hidden="true"></span>
          <div class="body">
            <div class="label">試煉</div>
            <p class="title">{{ trial.title }}</p>
            <p class="sub">{{ trial.sub }}</p>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scene {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding: 26px 0 56px;
  /* 6-stop 垂直漸層，每時段獨立停駐色（見 main.css --scene-sky-1..6）。禁止在此疊加金色 radial
     光暈——三輪迭代證實會讀成浮空色塊，見 design/quick-specs/home-scene-redesign.md「鐵則」。
     雙宣告＝sRGB fallback + oklab 內插：第二行在支援 `in oklab` 的瀏覽器（Safari 16.2+／
     Chromium／Firefox 近期版）覆蓋第一行，插值時繞開 sRGB 中段常見的濁灰/濁綠假象；不支援的
     瀏覽器（Safari 16.0/16.1）簡單地讓第二行整條宣告被忽略、停留在第一行的 sRGB 結果——
     不需要 @supports，CSS 對未知 gradient 語法本就是宣告層級忽略。 */
  background: linear-gradient(
    180deg,
    var(--scene-sky-1) 0%,
    var(--scene-sky-2) 20%,
    var(--scene-sky-3) 40%,
    var(--scene-sky-4) 62%,
    var(--scene-sky-5) 82%,
    var(--scene-sky-6) 100%
  );
  background: linear-gradient(
    180deg in oklab,
    var(--scene-sky-1) 0%,
    var(--scene-sky-2) 20%,
    var(--scene-sky-3) 40%,
    var(--scene-sky-4) 62%,
    var(--scene-sky-5) 82%,
    var(--scene-sky-6) 100%
  );
  /* Entrance: single opacity fade-up, ~620ms ease-out (atmospheric exception). */
  opacity: 0;
  transition: opacity 620ms cubic-bezier(0, 0, 0.2, 1);
}
.scene.is-lit {
  opacity: 1;
}
.scene::after {
  /* Height matches .scene's own padding-bottom so this fade-to-ground transition sits in the
     empty margin below .path-wrap and never bleeds under the trial node's text — previously a
     fixed 96px overlay overlapped .node-trial .sub, lightening its background and breaking
     contrast independent of time bucket (a11y audit, home-scene-redesign quick-spec). */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 56px;
  background: linear-gradient(180deg, transparent, var(--color-surface-base));
  pointer-events: none;
}

.atmo {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.atmo .streak {
  position: absolute;
  left: 6%;
  right: 6%;
  height: 1px;
}
.atmo .s1 {
  top: 12%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-ink-on-deep) 14%, transparent), transparent 70%);
}
.atmo .s2 {
  top: 96%;
  background: linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--color-gold) 10%, transparent), transparent);
}
/* 每時段的「光的事件」——不靠亮度階梯辨時段,靠光質:night 無光帶(關)、morning 冷白熾核心低窄帶、
   afternoon 天頂極淡高空白晝光(大尺度無邊界)、evening 暖白熾核心低窄帶。全寬 top-anchored 線性
   漸層,非 radial、非懸空色塊——鐵則允許的表達方式（見 main.css --scene-core-* 逐時段定義）。 */
.atmo .core {
  position: absolute;
  left: -10%;
  right: -10%;
  top: var(--scene-core-top);
  height: var(--scene-core-height);
  background: var(--scene-core-gradient);
  opacity: var(--scene-core-opacity);
  mix-blend-mode: screen;
}

/* 靜態顆粒層:限定在天空容器內（非整頁 fixed，行動效能考量），尺度見 main.css --texture-sky-grain。 */
.grain {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.14;
  mix-blend-mode: overlay;
  background-image: var(--texture-sky-grain);
  background-size: 200px 200px;
}

.stardust {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: var(--scene-star-opacity, 1);
  transition: opacity 620ms cubic-bezier(0, 0, 0.2, 1);
}
.star {
  position: absolute;
  border-radius: 999px;
  background: var(--color-ink-on-deep);
  box-shadow: 0 0 2px color-mix(in srgb, var(--color-ink-on-deep) 60%, transparent);
}

.scene-content {
  position: relative;
  z-index: 2;
}

/* 文字色固定不隨時段變化 — 星夜美學是暗空美學，四時段天空皆深，淺色文字全時段可讀
   （見 main.css --scene-ink/-dim，2026-07-20 定案：拿掉上一版的適應性深色文字）。 */
.scene-ink {
  color: var(--scene-ink);
}

.scene-avatar {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--color-ink-on-deep) 28%, transparent);
  flex-shrink: 0;
}

/* ---- 蜿蜒小徑 ---- */
.path-wrap {
  position: relative;
  margin-top: 40px;
  height: 360px;
}
.path-wrap svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.curve {
  fill: none;
  stroke: color-mix(in srgb, var(--color-ink-on-deep) 16%, transparent);
  stroke-width: 0.8;
  stroke-dasharray: 0.5 5;
  stroke-linecap: round;
}

.node {
  position: absolute;
  width: 64%;
  display: block;
  text-decoration: none;
  border-radius: 0.5rem;
}
.node:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 3px;
}
.node .dot {
  position: absolute;
  top: 2px;
  border-radius: 999px;
}
.node .label {
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--scene-ink-dim);
  margin-bottom: 4px;
}
.node .title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--scene-ink);
  font-weight: 700;
  line-height: 1.35;
  margin: 0;
}
.node .sub {
  font-size: 12.5px;
  color: var(--scene-ink-dim);
  margin: 4px 0 0;
  line-height: 1.5;
}

.node-cta {
  left: 6%;
  top: 2%;
  width: 74%;
}
.node-cta .dot {
  left: 2px;
  width: 14px;
  height: 14px;
  background: radial-gradient(circle at 35% 30%, #fffdf5, var(--color-gold-light) 40%, var(--color-gold) 75%);
  box-shadow:
    0 0 22px 6px color-mix(in srgb, var(--color-gold) 45%, transparent),
    0 0 4px 1px rgba(255, 255, 255, 0.8);
}
.node-cta .body {
  padding-left: 32px;
  min-height: 44px;
}
.node-cta .cta-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 12px;
}
.node-cta .cta-btn {
  min-height: 44px;
  border-radius: 999px;
}
.node-cta .secondary-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-left: -2px;
  padding: 0 2px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--scene-ink-dim);
  text-decoration: underline;
  text-underline-offset: 2px;
  background: none;
  border: none;
  cursor: pointer;
}
.node-cta .secondary-link:hover,
.node-cta .secondary-link:focus-visible {
  color: var(--scene-ink);
}
.node-cta .secondary-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
  border-radius: 4px;
}

.node-lesson {
  left: 32%;
  top: 37%;
  width: 68%;
  text-align: right;
}
.node-lesson .dot {
  right: 2px;
  left: auto;
  width: 8px;
  height: 8px;
  background: radial-gradient(circle at 35% 30%, #f8f0da, var(--color-gold) 70%);
  opacity: 0.85;
  box-shadow:
    0 0 10px 3px color-mix(in srgb, var(--color-gold) 28%, transparent),
    0 0 3px 1px rgba(255, 255, 255, 0.6);
}
.node-lesson .body {
  padding: 6px 24px 6px 0;
  min-height: 44px;
}

.node-trial {
  left: 8%;
  top: 76%;
  width: 62%;
}
.node-trial .dot {
  left: 3px;
  width: 4px;
  height: 4px;
  top: 6px;
  background: var(--color-ink-on-deep);
  box-shadow: 0 0 4px 1px color-mix(in srgb, var(--color-ink-on-deep) 50%, transparent);
}
.node-trial .body {
  padding: 6px 0 6px 22px;
  min-height: 44px;
}
.node-trial .title {
  font-size: 16px;
}
.node-trial .sub {
  opacity: 0.85;
}

@media (min-width: 768px) {
  .scene {
    padding: 34px 0 72px;
  }
  .path-wrap {
    height: 320px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene {
    opacity: 1;
    transition: none;
  }
  .stardust {
    transition: none;
  }
}
</style>
