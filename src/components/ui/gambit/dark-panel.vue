<script setup lang="ts">
/** accentLeft: a gold edge bar down the left side — marks a "pick up where you left off" panel
 *  (繼續對局) distinct from a plain focus panel. Gold = focus/reward per Gambit. */
defineProps<{ noPad?: boolean; accentLeft?: boolean }>()
</script>

<template>
  <!-- 深青瓷漸層焦點面板：上亮邊 + 下暗邊 + 左上斜向 sheen（光源左上），Gambit 招牌升起語言 -->
  <div
    class="dark-focus-panel relative overflow-hidden rounded-[14px]
           border-t border-t-white/18 border-l border-l-white/10 border-r border-r-black/15 border-b border-b-black/25
           shadow-[0_6px_20px_rgba(10,30,24,0.40),0_2px_6px_rgba(10,30,24,0.22)]"
    :class="noPad ? 'p-0' : 'px-[15px] py-[14px]'"
  >
    <div
      class="pointer-events-none absolute left-0 top-0 right-[55%] h-1/2 rounded-tl-[14px]
             bg-[linear-gradient(135deg,rgba(255,255,255,0.07)_0%,transparent_100%)]"
    />
    <div
      v-if="accentLeft"
      class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(to_bottom,#FFC94D,#F8B500)]"
    />
    <div class="relative z-1"><slot /></div>
  </div>
</template>
