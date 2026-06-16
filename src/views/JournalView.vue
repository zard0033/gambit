<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useJournalStore } from '@/stores/journal'
import type { JournalEntry } from '@/types/journal'
import { getLastSeenAt, isUnread, markSeen } from '@/lib/journal/unread'
import JournalLamp from '@/components/journal/JournalLamp.vue'
import JournalEntryCard from '@/components/journal/JournalEntryCard.vue'

const router = useRouter()
const journal = useJournalStore()

// 空狀態固定字串（Neve 語氣，無 emoji）— assert 相等用。
const EMPTY_STATE_COPY = '還沒有什麼好寫的。先下一盤吧。'

// 未讀水位：在此 visit mount 前捕捉，保持本次渲染穩定。mount 後 markSeen() 更新 localStorage，
// 下次開啟時 getLastSeenAt() 才讀到新值，使 marker 在本次可見一次後消失。
const lastSeenAt = getLastSeenAt()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
})

// 時間軸為組織主軸（誌的本質）：倒序時間流，掃到月份變化插一條月份標題。
// 卷不再當歸屬桶——它只在抵達筆上當「章節里程碑」小標（JournalEntryCard 處理）。
function monthLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '本月'
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1} 月`
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

interface MonthGroup {
  key: string
  label: string
  entries: { entry: JournalEntry; index: number }[]
}

const monthGroups = computed<MonthGroup[]>(() => {
  const groups: MonthGroup[] = []
  let cur: MonthGroup | null = null
  journal.entries.forEach((entry, index) => {
    const d = new Date(entry.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!cur || cur.key !== key) {
      cur = { key, label: monthLabel(entry.createdAt), entries: [] }
      groups.push(cur)
    }
    cur.entries.push({ entry, index })
  })
  return groups
})

// 收合舊月份：近期（最新月份）預設展開，更早收成可點的細條（疊起來＝累積視覺）。
const expanded = ref<Set<string>>(new Set())
watch(
  monthGroups,
  (groups) => {
    if (groups.length && expanded.value.size === 0) expanded.value = new Set([groups[0].key])
  },
  { immediate: true },
)
function isExpanded(key: string): boolean {
  return expanded.value.has(key)
}
function toggleMonth(key: string): void {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

const isEmpty = computed(() => journal.entries.length === 0)

function goBack(): void {
  router.push('/')
}

onMounted(async () => {
  await journal.load()
  markSeen()
})
</script>

<template>
  <div class="relative min-h-dvh bg-surface-deep text-ink-on-deep">
    <JournalLamp />

    <div class="relative mx-auto w-full max-w-xl px-5 pb-16">
      <!-- 頂列：頁內返回（無 tab bar）+ 標題 -->
      <div class="flex items-center justify-between pt-4">
        <button
          type="button"
          class="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-btn px-2 font-sans text-[14px] text-ink-on-deep-dim transition-colors hover:text-ink-on-deep"
          @click="goBack"
        >
          <ArrowLeft :size="18" :stroke-width="1.8" /> 返回
        </button>
        <h1 class="font-display text-lg font-bold text-ink-on-deep" tabindex="-1">棋誌</h1>
        <span class="w-16" aria-hidden="true" />
      </div>

      <!-- 燈光場景頭：Neve 招呼 -->
      <div class="px-2 pb-6 pt-10 text-center">
        <p class="font-display text-[22px] leading-relaxed text-ink-on-deep">{{ greeting }}</p>
        <p class="mt-2.5 font-lesson text-[15px] text-ink-on-deep-dim">我把你走過的，都記在這裡了。</p>
      </div>

      <!-- 空狀態 -->
      <div v-if="isEmpty" class="px-2 pt-8 text-center">
        <p class="font-lesson text-[16px] leading-[1.9] text-ink-on-deep-dim">{{ EMPTY_STATE_COPY }}</p>
      </div>

      <!-- 倒序時間軸：月份分段（近期展開、舊月收合）；onset 在最舊月份最底 -->
      <div v-else class="space-y-3">
        <section v-for="group in monthGroups" :key="group.key">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 min-h-[44px] pt-2 first:pt-0 font-display text-[15px] tracking-[0.06em] text-ink-on-deep-dim transition-colors hover:text-ink-on-deep"
            :aria-expanded="isExpanded(group.key)"
            @click="toggleMonth(group.key)"
          >
            <ChevronDown v-if="isExpanded(group.key)" :size="16" :stroke-width="1.8" aria-hidden="true" />
            <ChevronRight v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ group.label }}</span>
            <span v-if="!isExpanded(group.key)" class="font-num text-[12px] text-ink-on-deep-dim/80">{{ group.entries.length }} 篇</span>
            <span class="h-px flex-1 bg-white/10" aria-hidden="true" />
          </button>
          <div v-if="isExpanded(group.key)" class="mt-3 space-y-4">
            <JournalEntryCard v-for="it in group.entries" :key="it.entry.id" :entry="it.entry" :index="it.index" :unread="isUnread(it.entry, lastSeenAt)" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
