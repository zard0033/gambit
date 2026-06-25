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
  build: {
    rollupOptions: {
      output: {
        // 函式形式（vite 8 / rolldown 只支援函式，不支援物件 map）。維持原本分塊。
        manualChunks(id: string) {
          if (/[\\/]node_modules[\\/](vue3-chessboard|chessground|chess\.js)[\\/]/.test(id)) return 'chess-board'
          if (/[\\/]node_modules[\\/]chess-openings[\\/]/.test(id)) return 'chess-openings'
          return undefined
        },
      },
    },
  },
})
