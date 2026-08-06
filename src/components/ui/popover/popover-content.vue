<script setup lang="ts">
import { computed } from 'vue'
import { PopoverPortal, PopoverContent, type PopoverContentProps, type PopoverContentEmits, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<PopoverContentProps & { class?: string }>()
const emits = defineEmits<PopoverContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="forwarded"
      :side-offset="props.sideOffset ?? 8"
      :align="props.align ?? 'end'"
      :class="
        cn(
          'z-50 w-64 rounded-lg-card border border-line border-t-white/70 bg-surface-card p-1.5 text-ink shadow-card-hover',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
