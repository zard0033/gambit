<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { GUEST_ENTRY_KEY } from '@/router'
import brandMark from '@/assets/brand-mark.svg'

const authStore = useAuthStore()
const router = useRouter()

function continueAsGuest() {
  sessionStorage.setItem(GUEST_ENTRY_KEY, '1')
  router.push('/')
}
</script>

<template>
  <!-- 全屏深青瓷沉浸：棋局即道場 -->
  <div
    class="signin-bg flex min-h-dvh flex-col"
  >
    <div class="flex flex-1 flex-col items-center justify-center px-9">
      <!-- 品牌字標：金色國王剪影（brand-mark），金色留給 CTA -->
      <img
        :src="brandMark"
        alt=""
        aria-hidden="true"
        class="mb-6 h-24 w-auto drop-shadow-[0_0_28px_rgba(248,181,0,0.4)]"
      />
      <h1 class="mb-2 font-brand text-[32px] font-black tracking-[0.08em] text-ink-on-deep" tabindex="-1">
        GAMBIT
      </h1>
      <p class="mb-10 font-sans text-xs uppercase tracking-[0.3em] text-ink-on-deep-dim">Master the board</p>

      <div class="flex w-full max-w-sm flex-col gap-3">
        <p v-if="authStore.authError" class="text-sm text-danger-light">{{ authStore.authError }}</p>
        <button
          type="button"
          :disabled="authStore.isAuthLoading"
          class="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[13px] border border-white/20 bg-white/10 px-4 font-sans text-base font-medium text-ink-on-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xs transition-[background-color,transform,opacity] duration-150 hover:bg-white/16 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60 motion-safe:active:scale-[0.98]"
          @click="authStore.signInWithGoogle()"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          以 Google 帳號登入
        </button>
      </div>
    </div>

    <div class="px-9 pb-10">
      <div class="mx-auto flex max-w-sm flex-col">
        <div class="mb-4 flex items-center gap-3 text-ink-on-deep-dim/35">
          <span class="h-px flex-1 bg-current"></span>
          <span class="font-sans text-xs text-ink-on-deep-dim/75">或</span>
          <span class="h-px flex-1 bg-current"></span>
        </div>
        <button
          type="button"
          class="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[13px] border border-white/16 font-sans text-sm text-ink-on-deep transition-colors hover:bg-white/6 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
          @click="continueAsGuest"
        >
          以訪客身分繼續 <ArrowRight :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>
