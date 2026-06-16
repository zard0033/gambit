<script setup lang="ts">
// 一盞燈 — Inspira lamp 水平光錐 reskin 成 deep-jade。純 CSS 一次性綻放（無 motion-v、無無限脈動鐵則）；
// reduced-motion 下保留最終靜態發光。燈心＝暖象牙燭光 #FFE9C0（非品牌金 #F8B500，reward 金保持神聖）。
</script>

<template>
  <div class="lamp-stage" aria-hidden="true">
    <div class="ambient" />
    <div class="beam beam-left" />
    <div class="beam beam-right" />
    <div class="beam-line" />
  </div>
</template>

<style scoped>
.lamp-stage { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

/* 環境光：jade 世界的綠 + 一抹暖象牙，底部暗角包裹。 */
.ambient {
  position: absolute; inset: 0; opacity: 0; animation: fade-in 900ms ease forwards;
  background:
    radial-gradient(120% 60% at 50% -8%, rgba(127, 212, 168, 0.18), transparent 60%),
    radial-gradient(70% 32% at 50% 0%, rgba(255, 233, 192, 0.10), transparent 60%),
    radial-gradient(140% 70% at 50% 120%, rgba(0, 0, 0, 0.32), transparent 55%);
}

/* Inspira lamp 水平光錐 + 一道暖象牙光線 */
.beam { position: absolute; top: 0; height: 220px; width: 60%; filter: blur(40px); opacity: 0; animation: fade-in 900ms ease forwards; }
.beam-left { right: 50%; background: conic-gradient(from 70deg at center top, rgba(127, 212, 168, 0.30), transparent 70%); }
.beam-right { left: 50%; background: conic-gradient(from 290deg at center top, transparent 30%, rgba(127, 212, 168, 0.30)); }
.beam-line {
  position: absolute; top: 0; left: 50%; width: 46%; height: 2px; transform: translateX(-50%); opacity: 0;
  background: linear-gradient(90deg, transparent, #ffe9c0, transparent);
  box-shadow: 0 0 22px 4px rgba(255, 233, 192, 0.42);
  animation: fade-in 900ms ease 100ms forwards;
}

@keyframes fade-in { to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .ambient, .beam, .beam-line { animation: none; opacity: 1; }
}
</style>
