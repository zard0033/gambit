<script setup lang="ts">
/**
 * Header 設定齒輪（D6）— ProfileView 整頁下架後唯一的帳號/設定入口。取代原本連到 /profile 的
 * RouterLink。只裝 ProfileView 裡真正在動作的四項：對局紀錄連結、外觀切換、重置對局記錄、
 * 登入/登出——三個「即將推出」鎖住列（成就勳章／開局資料庫／帳號安全）不搬，本來就是佔位符。
 */
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Settings, BarChart3, RotateCcw, LogOut } from 'lucide-vue-next'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui-store'
import type { Theme } from '@/lib/theme'
import ResetHistoryDialog from '@/components/reset-history-dialog.vue'

// Only mounted for signed-in users (app-nav.vue shows a plain 登入 link to guests instead),
// so this never needs a guest branch — mirrors the pre-D6 header, which never linked guests to
// /profile either.
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const open = ref(false)
const showResetDialog = ref(false)

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'cream', label: '奶油' },
  { value: 'noir', label: '玄夜' },
]
const themeIndex = computed(() => themeOptions.findIndex((o) => o.value === uiStore.theme))

async function handleSignOut() {
  open.value = false
  await authStore.signOut()
  router.push('/sign-in')
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger
      aria-label="設定"
      class="flex items-center justify-center h-11 w-11 rounded-full text-ink-on-deep-dim hover:text-ink-on-deep hover:bg-white/8 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
    >
      <Settings :size="20" :stroke-width="1.8" aria-hidden="true" />
    </PopoverTrigger>

    <PopoverContent>
      <RouterLink
        to="/history"
        class="flex items-center gap-2.5 rounded-btn px-3 py-2.5 min-h-11 font-sans text-[15px] font-medium text-ink hover:bg-surface-hover transition-colors"
        @click="open = false"
      >
        <BarChart3 :size="17" :stroke-width="1.8" class="text-primary" />
        對局紀錄
      </RouterLink>

      <div class="my-1 border-t border-line-subtle" />

      <p id="settings-menu-appearance-label" class="px-3 pt-1.5 pb-1 font-sans text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">外觀</p>
      <div role="group" aria-labelledby="settings-menu-appearance-label" class="relative mx-1.5 mb-1.5 flex rounded-[10px] border border-line-subtle bg-surface-raised p-1">
        <div
          class="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] transition-transform duration-300 ease-out motion-reduce:transition-none"
          :style="{ transform: `translateX(${themeIndex * 100}%)` }"
        >
          <div class="h-full rounded-[7px] bg-primary shadow-button" />
        </div>
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="relative z-10 min-h-9 flex-1 rounded-[7px] font-sans text-sm font-medium transition-colors"
          :class="uiStore.theme === opt.value ? 'text-primary-fg' : 'text-ink-muted'"
          :aria-pressed="uiStore.theme === opt.value"
          @click="uiStore.setTheme(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="my-1 border-t border-line-subtle" />

      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-btn px-3 py-2.5 min-h-11 font-sans text-[15px] font-medium text-danger hover:bg-danger-light transition-colors"
        @click="open = false; showResetDialog = true"
      >
        <RotateCcw :size="17" :stroke-width="1.8" />
        重置對局記錄
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-btn px-3 py-2.5 min-h-11 font-sans text-[15px] font-medium text-ink hover:bg-surface-hover transition-colors"
        @click="handleSignOut"
      >
        <LogOut :size="17" :stroke-width="1.8" class="text-primary" />
        登出
      </button>
    </PopoverContent>
  </Popover>

  <ResetHistoryDialog v-if="showResetDialog" @close="showResetDialog = false" />
</template>
