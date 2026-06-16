<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChart3,
  Trophy,
  BookMarked,
  ShieldCheck,
  Settings,
  LogOut,
  LogIn,
  ChevronRight,
  Star,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

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
      { icon: Settings, label: '偏好設定', badge: '即將推出', locked: true },
      isGuest.value
        ? { icon: LogIn, label: '登入', to: '/sign-in' }
        : { icon: LogOut, label: '登出', destructive: true, onClick: handleSignOut },
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
      class="relative overflow-hidden bg-[linear-gradient(160deg,#2A6654_0%,#1E4D3E_55%,#1A4238_100%)] px-[18px] pb-5 pt-[22px]"
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
    </div>
  </div>
</template>
