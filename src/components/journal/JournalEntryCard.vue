<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import type { JournalEntry } from '@/types/journal'

const props = withDefaults(defineProps<{ entry: JournalEntry; index?: number; unread?: boolean }>(), { index: 0, unread: false })

const router = useRouter()

// 綁單一對局的筆（solace，sourceRefId＝那盤 game_sessions id）→ 可點，跳那盤棋憶。
// 里程碑筆（onset/arrival）不綁對局 → 不可點（memory GDD Rule 23 + Eason 2026-06-22）。
const gameId = computed(() => (props.entry.type === 'solace' ? props.entry.sourceRefId : null))
function openMemory(): void {
  if (gameId.value) router.push({ name: 'review', query: { gameId: gameId.value } })
}

// 固定物分級（journal-book-redesign，design/quick-specs/journal-book-redesign.md）：
// arrival＝滿版扉頁（整張卡就是章節公告，無固定物）；epiphany/solace＝蠟印（自己看出來的／被安慰的，
// 分量最重的兩枝筆）；onset（唯一一次，起點）＝和紙膠帶。目前 4 個 Pen 全部有歸屬，
// 迴紋針級（對局時刻）保留給未來新增的 pen，此版不生對應不會用到的固定物 CSS。
type Tier = 'frontispiece' | 'seal' | 'washi'
const tier = computed<Tier>(() => {
  if (props.entry.type === 'arrival') return 'frontispiece'
  if (props.entry.type === 'epiphany' || props.entry.type === 'solace') return 'seal'
  return 'washi'
})

// 扉頁：卷別字串（如「卷一規則」）前兩字＝小標序號，後兩字＝章節大標，不另建對照表。
const chapterOrdinal = computed(() => props.entry.volume?.slice(0, 2) ?? '')
const chapterTitle = computed(() => props.entry.volume?.slice(2) ?? '')

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const d = computed(() => new Date(props.entry.createdAt))
const dateLabel = computed(() => `${d.value.getDate()} 日 · 週${WEEKDAY[d.value.getDay()]}`)

// 微斜角度池（0.3–0.8deg 區間，精美不做舊）：依 index 輪替，扉頁不斜（滿版莊重）。
const ROTATION_POOL = [-0.6, 0.5, -0.3, 0.7]
const rotation = computed(() => (tier.value === 'frontispiece' ? 0 : ROTATION_POOL[props.index % ROTATION_POOL.length]))

// 一次性入場錯落（每張稍晚，像書頁逐張翻開）；reduced-motion 下停用。
const riseDelay = computed(() => `${Math.min(props.index * 70, 320)}ms`)
</script>

<template>
  <article
    class="journal-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
    :class="[`journal-card--${tier}`, { 'journal-card--linked': gameId }]"
    :style="{ animationDelay: riseDelay, '--card-rot': `${rotation}deg` }"
    :role="gameId ? 'button' : undefined"
    :tabindex="gameId ? 0 : undefined"
    :aria-label="gameId ? '回到這盤棋的棋憶' : undefined"
    @click="openMemory"
    @keydown.enter.prevent="openMemory"
    @keydown.space.prevent="openMemory"
  >
    <template v-if="entry.type === 'arrival'">
      <span v-if="unread" class="journal-card__unread journal-card__unread--frontispiece" data-testid="journal-unread-dot" aria-hidden="true" />
      <p class="frontispiece-ordinal font-num">{{ chapterOrdinal }}</p>
      <h2 class="frontispiece-title font-display">{{ chapterTitle }}</h2>
      <p class="journal-body frontispiece-body font-lesson">{{ entry.body }}</p>
    </template>
    <template v-else>
      <span v-if="tier === 'seal'" class="fixture fixture-seal" aria-hidden="true" />
      <span v-else class="fixture fixture-washi" aria-hidden="true" />
      <p class="mb-1.5 flex items-center gap-1.5 font-num text-[12.5px] tracking-[0.04em] text-ink-faint">
        <span v-if="unread" class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#7EBEA5]/60" data-testid="journal-unread-dot" aria-hidden="true" />{{ dateLabel }}
      </p>
      <p class="journal-body font-lesson text-[17px] leading-[1.9] text-ink">{{ entry.body }}</p>
      <p v-if="gameId" class="mt-2.5 flex items-center justify-end gap-0.5 font-sans text-[13px] text-ink-muted">回到那盤<ChevronRight :size="14" :stroke-width="1.8" aria-hidden="true" /></p>
    </template>
  </article>
</template>

<style scoped>
/* 工藝紙片便箋：細紙紋（feTurbulence，main.css --texture-paper-grain）+ 雙層影
   （貼合陰影＋浮於 jade 頁面上的環境暈影）+ 髮絲內邊框，模擬被拿起的厚度。角度由 --card-rot 控制，
   與入場動畫同一個 transform（rotate 在 from/to 兩端都保留，動畫只補 translateY）。 */
.journal-card {
  position: relative;
  isolation: isolate;
  opacity: 0;
  transform: translateY(8px) rotate(var(--card-rot, 0deg));
  animation: card-rise 600ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes card-rise {
  to {
    opacity: 1;
    transform: rotate(var(--card-rot, 0deg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .journal-card { animation: none; opacity: 1; transform: rotate(var(--card-rot, 0deg)); }
}

/* CJK 不可斜體（假斜扭曲字形）— 顯式鎖正體。 */
.journal-body { font-style: normal; }

/* 便箋（seal / washi 共用底）：暖白紙、雙層影、髮絲內框。 */
.journal-card--seal,
.journal-card--washi {
  border-radius: 3px;
  padding: 18px 20px;
  background-color: #fcf9f3;
  border: 1px solid #cdb999;
  box-shadow:
    0 1px 2px rgba(61, 34, 16, 0.16),
    0 10px 22px rgba(8, 24, 20, 0.28);
}
.journal-card--seal::before,
.journal-card--washi::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background-image: var(--texture-paper-grain);
  background-size: 100px 100px;
  mix-blend-mode: multiply;
  opacity: 0.05;
  pointer-events: none;
  z-index: 0;
}
.journal-card--seal::after,
.journal-card--washi::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 2px;
  border: 1px solid rgba(61, 34, 16, 0.08);
  pointer-events: none;
  z-index: 0;
}
.journal-card--seal > *,
.journal-card--washi > * {
  position: relative;
  z-index: 1;
}
.journal-card--washi {
  padding: 13px 18px 14px;
  background-color: var(--color-surface-raised);
  box-shadow:
    0 1px 1px rgba(61, 34, 16, 0.12),
    0 5px 12px rgba(8, 24, 20, 0.22);
}

/* 蠟印（epiphany／solace，分量最重）：不規則蠟滴輪廓 + 浮雕光澤 + 壓印兵形。 */
.fixture-seal {
  position: absolute;
  top: -11px;
  left: 22px;
  width: 26px;
  height: 26px;
  z-index: 2;
  border-radius: 47% 53% 50% 46% / 52% 48% 54% 46%;
  transform: rotate(-7deg);
  background: radial-gradient(circle at 32% 28%, var(--color-gold-light), var(--color-gold-dark) 68%, var(--color-gold-ink) 100%);
  box-shadow:
    0 3px 5px rgba(61, 34, 16, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.35),
    inset 0 -2px 3px rgba(0, 0, 0, 0.3);
}
.fixture-seal::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.28);
}
.fixture-seal::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: rgba(61, 34, 16, 0.45);
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext x='12' y='17' font-size='16' text-anchor='middle' font-family='Georgia, serif' fill='white'%3E%26%239823;%3C/text%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext x='12' y='17' font-size='16' text-anchor='middle' font-family='Georgia, serif' fill='white'%3E%26%239823;%3C/text%3E%3C/svg%3E");
  mask-repeat: no-repeat;
  mask-position: center 56%;
  mask-size: 48% 48%;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center 56%;
  -webkit-mask-size: 48% 48%;
  pointer-events: none;
}

/* 和紙膠帶一角（onset，唯一一次的起點）。 */
.fixture-washi {
  position: absolute;
  top: -9px;
  left: 14px;
  width: 46px;
  height: 17px;
  z-index: 2;
  background: repeating-linear-gradient(115deg, color-mix(in srgb, var(--color-primary-soft) 85%, transparent) 0 6px, color-mix(in srgb, var(--color-primary) 55%, transparent) 6px 12px);
  transform: rotate(-4deg);
  opacity: 0.92;
  border-radius: 1px;
  box-shadow: 0 1px 3px rgba(61, 34, 16, 0.2);
}

/* 綁對局的筆＝可點回那盤棋憶；hover 只動 border-color（不動 box-shadow，守動效鐵則）。 */
.journal-card--linked { cursor: pointer; transition: border-color 150ms ease; }
.journal-card--linked:hover { border-color: #d8c4a0; }

/* 章節扉頁（arrival）：滿版深青，邊到邊（撐破頁面 px-5），莊重不斜。 */
.journal-card--frontispiece {
  margin: 8px -20px;
  padding: 44px 28px;
  text-align: center;
  overflow: hidden;
  background:
    radial-gradient(90% 60% at 50% 0%, rgba(248, 181, 0, 0.11), transparent 60%),
    radial-gradient(140% 90% at 50% 120%, rgba(0, 0, 0, 0.24), transparent 70%),
    linear-gradient(150deg, var(--color-surface-deep), var(--color-primary-dark));
}
.journal-card--frontispiece::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--texture-paper-grain);
  background-size: 120px 120px;
  mix-blend-mode: overlay;
  opacity: 0.1;
  pointer-events: none;
}
.frontispiece-ordinal {
  position: relative;
  font-size: 12px;
  color: var(--color-ink-on-deep);
  letter-spacing: 0.14em;
}
.frontispiece-title {
  position: relative;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-ink-on-deep);
  margin: 10px 0 16px;
}
.frontispiece-body {
  position: relative;
  font-size: 16px;
  line-height: 1.9;
  color: var(--color-ink-on-deep);
  max-width: 28ch;
  margin: 0 auto;
}
.journal-card__unread--frontispiece {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(126, 190, 165, 0.7);
}
</style>
