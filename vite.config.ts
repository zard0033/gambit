import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // pgn-viewer doesn't export CSS in its package.json exports map; bypass via absolute path
      {
        find: '@lichess-org/pgn-viewer/dist/lichess-pgn-viewer.css',
        replacement: fileURLToPath(
          new URL('./node_modules/@lichess-org/pgn-viewer/dist/lichess-pgn-viewer.css', import.meta.url),
        ),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['stockfish'],
  },
  assetsInclude: ['**/*.wasm'],
  // manualChunks 只留 chess-openings 一條：1.17MB 純資料包、永不變動，獨立成塊才不會
  // 跟著 MemoryView 的程式碼改動一起快取失效。其餘不設——vite 8 的 rolldown shim 會把
  // @vue runtime 誤併進含 UI 依賴的命名 chunk（實測 vue 被塞進 chess-board 塊、entry 因此
  // preload 整包 207KB 棋盤庫）；rolldown 自動分塊依可達性拆，chess 庫自然不進首屏。
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (/[\\/]node_modules[\\/]chess-openings[\\/]/.test(id)) return 'chess-openings'
          return undefined
        },
      },
    },
  },
})
