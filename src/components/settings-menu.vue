<script setup lang="ts">
/**
 * Header 設定齒輪（D6）— ProfileView 整頁下架後唯一的帳號/設定入口。取代原本連到 /profile 的
 * RouterLink。裝 ProfileView 裡真正在動作的三項：對局紀錄連結、重置對局記錄、登出——
 * 三個「即將推出」鎖住列（成就勳章／開局資料庫／帳號安全）不搬，本來就是佔位符。
 * 外觀切換已隨 noir 主題整組下架（2026-08-06，Eason 拍板只留 cream+jade）。
 *
 * 訪客也掛這顆（health-check Q9 缺口修復，2026-08-06）：對局紀錄／重置對局記錄本來就是
 * localStorage-safe——這裡按的「重置對局記錄」開 ResetHistoryDialog，它呼叫
 * gameHistory.resetHistory() → data-sync.ts::deleteGameHistory()，對 !userId 直接
 * return true，只是先前沒有 UI 入口。登出鈕對訪客沒有意義，用 authStore.userId 蓋掉；
 * app-nav.vue 的「登入」連結對訪客照舊保留在旁邊，不重複。
 */
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Settings, BarChart3, RotateCcw, LogOut } from 'lucide-vue-next'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAuthStore } from '@/stores/auth'
import ResetHistoryDialog from '@/components/reset-history-dialog.vue'

const router = useRouter()
const authStore = useAuthStore()

const open = ref(false)
const showResetDialog = ref(false)

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

      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-btn px-3 py-2.5 min-h-11 font-sans text-[15px] font-medium text-danger hover:bg-danger-light transition-colors"
        @click="open = false; showResetDialog = true"
      >
        <RotateCcw :size="17" :stroke-width="1.8" />
        重置對局記錄
      </button>

      <button
        v-if="authStore.userId"
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
