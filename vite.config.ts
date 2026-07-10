import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [
    vue(),
    // ADR-0016: autoUpdate is load-bearing — see CLAUDE.md "PWA（Add to Home Screen／離線）" note.
    // A prompt-based registerType would let the SW lock users onto a stale deployed version.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gambit',
        short_name: 'Gambit',
        description: '跟著 Neve 學西洋棋——從基礎規則到戰術實戰',
        theme_color: '#103029',
        background_color: '#103029',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell only: JS/CSS/HTML/SVG + the small PNG icons not covered by the manifest's
        // own icon list (that list is auto-precached via includeManifestIcons, default true).
        globPatterns: ['**/*.{js,css,html,svg}', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'],
        // Stockfish WASM (~7.3MB) and font files (~8.6MB) never precache — see ADR-0016 §Chosen Approach.
        globIgnores: ['stockfish/**', 'fonts/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/stockfish\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'stockfish-engine',
              expiration: { maxEntries: 4 },
            },
          },
          {
            urlPattern: ({ url }) => /\/fonts\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
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
