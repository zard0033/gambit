<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChart3,
  Trophy,
  BookMarked,
  ShieldCheck,
  LogOut,
  LogIn,
  ChevronRight,
  Star,
  RotateCcw,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui-store'
import type { Theme } from '@/lib/theme'
import ResetHistoryDialog from '@/components/reset-history-dialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const showResetDialog = ref(false)

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'cream', label: '奶油' },
  { value: 'noir', label: '玄夜' },
]
const themeIndex = computed(() => themeOptions.findIndex((o) => o.value === uiStore.theme))

const isGuest = computed(() => !authStore.userId)
const displayName = computed(() => authStore.email?.split('@')[0] ?? '訪客')

// 戰績統計尚未實作 → placeholder
const stats = [
  { val: '—', label: '勝' },
  { val: '—', label: '和' },
  { val: '—', label: '負' },
  { val: '—', label: '連勝' },
]

async function handleSignOut() {
  await authStore.signOut()
  router.push('/sign-in')
}

interface MenuRow {
  icon: Component
  label: string
  to?: string
  badge?: string
  locked?: boolean
  destructive?: boolean
  onClick?: () => void
}

const menuGroups = computed<{ title: string; rows: MenuRow[] }[]>(() => [
  {
    title: '我的',
    rows: [
      { icon: BarChart3, label: '對局紀錄', to: '/history' },
      { icon: Trophy, label: '成就勳章', badge: '即將推出', locked: true },
      { icon: BookMarked, label: '開局資料庫', badge: '即將推出', locked: true },
    ],
  },
  {
    title: '設定',
    rows: [
      { icon: ShieldCheck, label: '帳號安全', badge: '即將推出', locked: true },
      isGuest.value
        ? { icon: LogIn, label: '登入', to: '/sign-in' }
        : { icon: LogOut, label: '登出', destructive: true, onClick: handleSignOut },
    ],
  },
  {
    title: '資料',
    rows: [
      { icon: RotateCcw, label: '重置對局記錄', destructive: true, onClick: () => { showResetDialog.value = true } },
    ],
  },
])

function handleRow(row: MenuRow) {
  if (row.locked) return
  if (row.to) router.push(row.to)
  else row.onClick?.()
}
</script>

<template>
  <div class="pb-7">
    <!-- Hero — 深青瓷，貼齊頂部 -->
    <div
      class="dark-focus-panel relative overflow-hidden px-[18px] pb-5 pt-[22px]"
    >
      <div class="mb-[18px] flex items-center gap-3.5">
        <div
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-[34px] leading-none border-[2.5px] border-gold shadow-[0_0_18px_rgba(248,181,0,0.35)]"
          aria-hidden="true"
        >
          ♚
        </div>
        <div>
          <p class="mb-0.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-gold">{{ isGuest ? '訪客' : '玩家' }}</p>
          <h1 class="mb-1.5 font-display text-[22px] font-bold leading-tight text-ink-on-deep" tabindex="-1">
            {{ displayName }}
          </h1>
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 font-sans text-[11px] text-ink-on-deep-dim"
          >
            <Star :size="11" class="text-gold" /> 尚未評分
          </span>
        </div>
      </div>

      <!-- 戰績 strip -->
      <div class="flex overflow-hidden rounded-[10px] border border-white/6 bg-black/20">
        <div
          v-for="(s, i) in stats"
          :key="s.label"
          class="flex-1 py-2.5 text-center"
          :class="i < stats.length - 1 && 'border-r border-white/8'"
        >
          <div class="font-num text-lg font-bold leading-none text-ink-on-deep">{{ s.val }}</div>
          <div class="mt-1 font-sans text-[10px] text-ink-on-deep-dim">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- 訪客：登入價值定位＝雲端備份・跨裝置同步 -->
    <button
      v-if="isGuest"
      type="button"
      class="mx-[18px] mt-4 flex w-[calc(100%-36px)] items-center gap-3 rounded-[14px] border border-gold/40 bg-gold/8 px-4 py-3.5 text-left transition-colors hover:bg-gold/[0.14] active:scale-[0.99]"
      @click="router.push('/sign-in')"
    >
      <span class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gold/20 text-gold">
        <LogIn :size="17" :stroke-width="1.8" />
      </span>
      <span class="flex-1">
        <span class="block font-sans text-[15px] font-bold text-ink">登入以雲端備份・跨裝置同步</span>
        <span class="block font-sans text-xs text-ink-muted">訪客資料存於此裝置</span>
      </span>
      <ChevronRight :size="15" class="text-gold" :stroke-width="1.8" />
    </button>

    <!-- 選單群組 -->
    <div v-for="group in menuGroups" :key="group.title" class="px-[18px] pt-4">
      <p class="mb-2 font-sans text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
        {{ group.title }}
      </p>
      <div class="overflow-hidden rounded-[14px] border border-line-subtle bg-surface-card shadow-card">
        <button
          v-for="(row, i) in group.rows"
          :key="row.label"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
          :class="[
            i < group.rows.length - 1 && 'border-b border-line-subtle',
            row.locked ? 'opacity-50 cursor-default' : 'hover:bg-surface-hover',
          ]"
          :disabled="row.locked"
          @click="handleRow(row)"
        >
          <span
            class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
            :class="row.destructive ? 'bg-danger-light text-danger' : 'bg-surface-raised text-primary'"
          >
            <component :is="row.icon" :size="17" :stroke-width="1.8" />
          </span>
          <span
            class="flex-1 font-sans text-[15px] font-medium"
            :class="row.destructive ? 'text-danger' : 'text-ink'"
          >
            {{ row.label }}
          </span>
          <span
            v-if="row.badge"
            class="rounded-full bg-surface-mid px-2.5 py-0.5 font-sans text-xs text-ink-muted"
          >
            {{ row.badge }}
          </span>
          <ChevronRight
            v-if="row.to && !row.locked"
            :size="15"
            class="text-ink-faint"
            :stroke-width="1.8"
          />
        </button>
      </div>

      <!-- 外觀主題切換（cream / noir）— 緊接設定群組，segmented control 滑動 indicator -->
      <template v-if="group.title === '設定'">
        <p id="profile-appearance-label" class="mb-1.5 mt-3 font-sans text-[13px] font-medium text-ink-muted">外觀</p>
        <div role="group" aria-labelledby="profile-appearance-label" class="relative flex rounded-[14px] border border-line-subtle bg-surface-card p-1 shadow-card">
          <div
            class="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] transition-transform duration-300 ease-out motion-reduce:transition-none"
            :style="{ transform: `translateX(${themeIndex * 100}%)` }"
          >
            <div class="h-full rounded-[10px] bg-primary shadow-button" />
          </div>
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="relative z-10 min-h-[44px] flex-1 rounded-[10px] font-sans text-[15px] font-medium transition-colors"
            :class="uiStore.theme === opt.value ? 'text-primary-fg' : 'text-ink-muted'"
            :aria-pressed="uiStore.theme === opt.value"
            @click="uiStore.setTheme(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>
    </div>

    <ResetHistoryDialog v-if="showResetDialog" @close="showResetDialog = false" />
  </div>
</template>
