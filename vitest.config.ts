import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
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
  test: {
    globals: true,
    setupFiles: ['tests/setup-node26-compat.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/smoke/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'test-results/coverage',
    },
    outputFile: {
      json: 'test-results/vitest-results.json',
    },
  },
})
