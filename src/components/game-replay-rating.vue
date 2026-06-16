<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Star } from 'lucide-vue-next'

interface Props {
  gameId: string
}

const props = defineProps<Props>()

const rating = ref<number | null>(null)
const notes = ref('')

const storageKey = computed(() => `pgr:replay:${props.gameId}`)

function loadRating() {
  try {
    const data = localStorage.getItem(storageKey.value)
    if (data) {
      const parsed = JSON.parse(data)
      rating.value = parsed.rating
      notes.value = parsed.notes
    }
  } catch {
    console.error('[GameReplayRating] Failed to load data')
  }
}

function saveRating() {
  try {
    const data = {
      rating: rating.value,
      notes: notes.value.slice(0, 200), // Max 200 chars
    }
    localStorage.setItem(storageKey.value, JSON.stringify(data))
  } catch {
    console.error('[GameReplayRating] Failed to save data')
  }
}

function setRating(value: number) {
  if (rating.value === value) {
    rating.value = null
  } else {
    rating.value = value
  }
  saveRating()
}

function onNotesBlur() {
  saveRating()
}

onMounted(() => {
  loadRating()
})

watch(() => props.gameId, () => {
  loadRating()
})
</script>

<template>
  <div class="mt-4 rounded-card border border-line-subtle bg-surface-card p-4">
    <!-- 評分 -->
    <div class="mb-4">
      <label class="mb-2 block font-sans text-sm font-medium text-ink">這盤棋感覺如何？</label>
      <div class="flex gap-1">
        <button
          v-for="star in 5"
          :key="star"
          type="button"
          :aria-pressed="rating === star"
          :aria-label="`${star} 星`"
          class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-btn transition-colors hover:bg-surface-hover"
          @click="setRating(star)"
        >
          <Star
            :size="24"
            :stroke-width="1.8"
            :class="rating && rating >= star ? 'fill-gold text-gold' : 'text-ink-faint'"
          />
        </button>
      </div>
    </div>

    <!-- 筆記 -->
    <div>
      <label for="replay-notes" class="mb-2 block font-sans text-sm font-medium text-ink">
        筆記（選填，最多 200 字）
      </label>
      <textarea
        id="replay-notes"
        v-model="notes"
        maxlength="200"
        class="w-full rounded-card border border-line bg-surface-base px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
        placeholder="例如：第 15 手可以守得更好…"
        rows="3"
        @blur="onNotesBlur"
      />
      <div class="mt-1 font-num text-xs tabular-nums text-ink-faint">{{ notes.length }}/200</div>
    </div>
  </div>
</template>
