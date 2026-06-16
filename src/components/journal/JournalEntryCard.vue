<script setup lang="ts">
import { computed } from 'vue'
import type { JournalEntry, Volume } from '@/types/journal'

const props = withDefaults(defineProps<{ entry: JournalEntry; index?: number }>(), { index: 0 })

// 抵達筆＝旅程章節里程碑：卡上加一條章節小標（時間軸 IA 下，卷只當里程碑、不當歸屬桶）。
const VOLUME_LABEL: Record<Volume, string> = {
  卷一規則: '卷一 · 規則',
  卷二戰術: '卷二 · 戰術',
  卷三開局: '卷三 · 開局',
  卷四殘局: '卷四 · 殘局',
}
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const d = computed(() => new Date(props.entry.createdAt))
const dateLabel = computed(() => `${d.value.getDate()} 日 · 週${WEEKDAY[d.value.getDay()]}`)
const milestone = computed(() =>
  props.entry.type === 'arrival' && props.entry.volume ? VOLUME_LABEL[props.entry.volume] : null,
)
// 一次性入場錯落（每張稍晚，像書頁逐張翻開）；reduced-motion 下停用。
const riseDelay = computed(() => `${Math.min(props.index * 70, 320)}ms`)
</script>

<template>
  <article class="journal-card rounded-card px-5 py-[18px]" :style="{ animationDelay: riseDelay }">
    <div
      v-if="milestone"
      class="mb-2.5 flex items-center justify-center gap-2.5 font-display text-[13px] tracking-[0.06em] text-primary-dark"
    >
      <span class="h-px w-6 bg-primary-dark/30" aria-hidden="true" />{{ milestone }}<span class="h-px w-6 bg-primary-dark/30" aria-hidden="true" />
    </div>
    <p class="mb-1.5 font-num text-[12.5px] tracking-[0.04em] text-ink-faint">{{ dateLabel }}</p>
    <p class="journal-body font-lesson text-[17px] leading-[1.9] text-ink">{{ entry.body }}</p>
  </article>
</template>

<style scoped>
/* cream 紙頁：細紙紋 + 暖邊 + 浮在 jade 上的暖陰影（box-shadow 為靜態，不動畫）。 */
.journal-card {
  position: relative;
  background-color: #fcf9f3;
  background-image: radial-gradient(rgba(61, 34, 16, 0.025) 1px, transparent 1px);
  background-size: 4px 4px;
  border: 1px solid #ece1cd;
  box-shadow: 0 1px 2px rgba(61, 34, 16, 0.05), 0 12px 28px rgba(8, 24, 20, 0.32);
  opacity: 0; transform: translateY(8px);
  animation: card-rise 600ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
/* CJK 不可斜體（假斜扭曲字形）— 顯式鎖正體。 */
.journal-body { font-style: normal; }

@keyframes card-rise { to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .journal-card { animation: none; opacity: 1; transform: none; }
}
</style>
