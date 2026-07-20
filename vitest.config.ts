import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Inherit plugins + resolve.alias (incl. the pgn-viewer CSS workaround) from vite.config
// so they never drift between build and test.
export default mergeConfig(
  viteConfig,
  defineConfig({
    // prepush hook 用獨立快取跑（shell-gate.js 設此環境變數）：主快取與 hook 快取互不污染，
    // 任一邊被 Windows 間歇性 dep-optimizer 毒化都不再連坐（見 technical-preferences「vitest 假紅」節）。
    // 未設環境變數時＝vite 預設 node_modules/.vite，一般開發/CI 行為不變。
    cacheDir: process.env.VITEST_CACHE_DIR || 'node_modules/.vite',
    test: {
      globals: true,
      // 重負載下（VSCode 重建索引等）全 worker 數會讓 auth-guard timeout / opening-lookup 效能斷言
      // 間歇紅，兩台機器皆以 4 實測穩定（見 technical-preferences「vitest 假紅」節；快取毒化是另一問題）。
      maxWorkers: 4,
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
  }),
)
