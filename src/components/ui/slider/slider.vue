<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    modelValue?: number[]
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    class?: string
  }>(),
  { min: 0, max: 100, step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>()
</script>

<template>
  <SliderRoot
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event ?? [])"
    :class="cn('relative flex w-full touch-none select-none items-center', props.class)"
  >
    <SliderTrack class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-hover">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, i) in modelValue ?? [0]"
      :key="i"
      class="relative block h-4 w-4 rounded-full border-2 border-primary bg-surface-card shadow-button transition-colors before:absolute before:-inset-3.5 before:content-[''] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    />
  </SliderRoot>
</template>
