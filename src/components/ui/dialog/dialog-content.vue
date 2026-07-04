<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  type DialogContentProps,
  type DialogContentEmits,
  useForwardPropsEmits,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<DialogContentProps & { class?: string }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <!-- Gambit cream 對話框：純色 cream + 強柔陰影（popover 級），非 RPG 貼圖 -->
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 p-6 duration-200',
          'bg-surface-card text-ink rounded-lg-card border border-line border-t-white/70',
          'shadow-[0_12px_32px_rgba(61,34,16,0.16),0_4px_10px_rgba(61,34,16,0.10)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        class="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink-muted opacity-70 transition-all hover:bg-surface-hover hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
      >
        <X class="h-5 w-5" />
        <span class="sr-only">關閉</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
