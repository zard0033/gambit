/** Maximum number of unsynced games stored in localStorage before oldest is dropped. */
export const UNSYNCED_QUEUE_MAX = 50

// 2026-07-03 移除三個從未接線的常數（SYNC_BASE_DELAY_MS / SYNC_MAX_DELAY_MS / TOKEN_REFRESH_BUFFER_MS）：
// token 續期由 supabase-js autoRefreshToken 內建；同步失敗靠 unsynced queue 下次啟動 flush 兜底。
// 若日後實作 session 內退避重試，設計參數見 design/gdd/supabase-integration.md §Retry。
