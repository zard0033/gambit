<script setup lang="ts">
import { computed } from 'vue'
import { House, BookOpen } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import brandMark from '@/assets/brand-mark.svg'
import { useAuthStore } from '@/stores/auth'
import SettingsMenu from '@/components/settings-menu.vue'

const authStore = useAuthStore()
const route = useRoute()

// Mobile floating pill shows the label only on the active tab (icon-only otherwise), so we need the
// active state in script. Matches RouterLink semantics: exact for 首頁 (/), prefix for the rest.
const isActive = (to: string): boolean => (to === '/' ? route.path === '/' : route.path.startsWith(to))

// Index of the active tab → drives the sliding jade indicator's translateX. -1 = no tab active
// (e.g. /profile, /review), indicator hidden.
const activeIndex = computed(() => NAV_ITEMS.findIndex((i) => isActive(i.to)))

// Primary destinations — 首頁 + 學習. 對局 has no tab: a game always starts from the
// global setup modal (home card / 再來一局), so a nav entry to the bare /play board is redundant.
// Account/profile lives in the top-right header. Shared by the desktop top bar + mobile bottom bar.
const NAV_ITEMS = [
  { to: '/', label: '首頁', icon: House },
  { to: '/learn', label: '學習', icon: BookOpen },
] as const
</script>

<template>
  <!-- Top app bar — 純色深青瓷（取代木紋照片底），頂端微光 sheen -->
  <header
    class="app-header-bg sticky top-0 z-30 border-b border-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
  >
    <div class="max-w-6xl mx-auto flex items-center gap-1 px-4 h-14">
      <!-- 品牌字標：金徽（國王剪影）+ Cinzel GAMBIT wordmark -->
      <RouterLink to="/" class="flex items-center gap-2 mr-3" aria-label="GAMBIT 首頁">
        <img
          :src="brandMark"
          alt=""
          aria-hidden="true"
          class="h-[18px] w-auto drop-shadow-[0_0_8px_rgba(248,181,0,0.35)]"
        />
        <span class="font-brand font-black text-lg tracking-[0.04em] text-ink-on-deep translate-y-px">GAMBIT</span>
      </RouterLink>

      <!-- Desktop primary nav (mobile uses the bottom bar) -->
      <nav class="hidden md:flex items-center gap-1" aria-label="主要導覽">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3.5 h-9 rounded-full text-sm font-medium text-ink-on-deep-dim hover:text-ink-on-deep hover:bg-white/8 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
          active-class="text-white! font-bold! bg-primary"
        >
          <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <span class="flex-1" />

      <!-- Account: 登入 when signed out, 設定齒輪 when signed in (D6：登出／對局紀錄／外觀／重置都在裡面). -->
      <RouterLink
        v-if="!authStore.userId"
        to="/sign-in"
        class="flex items-center min-h-[44px] px-4 rounded-full text-sm font-medium text-ink-on-deep-dim hover:text-ink-on-deep hover:bg-white/8 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
        active-class="text-ink-on-deep!"
      >
        登入
      </RouterLink>
      <SettingsMenu v-else />
    </div>
  </header>

  <!-- Mobile bottom nav — floating jade pill. Equal-width tabs with a single jade indicator that
       slides (translateX) between them; the active tab shows its label. Solid jade (no backdrop-blur-sm:
       on iOS the blur repaints every frame and stutters). pointer-events-none wrapper so taps beside
       the pill still reach content. -->
  <nav
    class="md:hidden fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pointer-events-none"
    aria-label="主要導覽"
  >
    <div
      class="app-bottomnav-bg pointer-events-auto rounded-full border border-white/16 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_30px_rgba(0,0,0,0.45)]"
    >
      <div class="relative flex">
        <!-- Sliding jade indicator: one slot wide, translateX by activeIndex. -->
        <div
          class="pointer-events-none absolute inset-y-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
          :class="activeIndex < 0 ? 'opacity-0' : 'opacity-100'"
          :style="{ width: `${100 / NAV_ITEMS.length}%`, transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }"
        >
          <div class="mx-1 h-full rounded-full bg-white/13 border border-white/[0.28] shadow-[0_3px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]" />
        </div>
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :aria-label="item.label"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          class="relative z-10 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
          :class="isActive(item.to) ? 'text-white' : 'text-ink-on-deep-dim'"
        >
          <component :is="item.icon" :size="23" :stroke-width="1.8" aria-hidden="true" />
          <span v-if="isActive(item.to)" class="text-[13px] font-bold">{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
