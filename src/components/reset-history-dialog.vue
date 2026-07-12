<script setup lang="ts">
/**
 * ProfileView「重置對局記錄」二次確認。危險動作區平靜但明確（非紅色恐嚇風，鐵則）——說清楚會刪什麼、
 * 保留什麼，再讓使用者按下確認。刪除範圍：對局歷史（雲端 game_sessions 自己的 rows / 訪客 localStorage）
 * ＋進行中對局。不動棋誌、棋憶回顧、課程與試煉進度。
 * Mount/unmount owned by the parent (v-if), mirrors play-setup-modal.vue's open+emit('close') shape.
 */
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGameHistoryStore } from '@/stores/game-history'
import { useResumeGameStore } from '@/stores/resume-game'

const emit = defineEmits<{ close: [] }>()

const gameHistory = useGameHistoryStore()
const resumeGame = useResumeGameStore()

// Dialog owns overlay click / Esc / × close. Any close gesture flips open → emit('close').
const open = ref(true)
watch(open, (v) => {
  if (!v) emit('close')
})

const isDeleting = ref(false)
const failed = ref(false)

async function confirmReset(): Promise<void> {
  isDeleting.value = true
  failed.value = false
  const ok = await gameHistory.resetHistory()
  if (!ok) {
    isDeleting.value = false
    failed.value = true
    return
  }
  await resumeGame.clear()
  isDeleting.value = false
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>重置對局記錄</DialogTitle>
        <DialogDescription>
          這會清除你的對局歷史與目前進行中的對局，且無法復原。棋誌、棋憶回顧、課程與試煉進度不受影響。
        </DialogDescription>
      </DialogHeader>

      <p v-if="failed" class="text-sm text-danger">清除失敗，請稍後再試一次。</p>

      <DialogFooter>
        <Button variant="secondary" :disabled="isDeleting" @click="open = false">取消</Button>
        <Button variant="danger" :disabled="isDeleting" @click="confirmReset">
          {{ isDeleting ? '清除中…' : '確定清除' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
