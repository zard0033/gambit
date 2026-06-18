import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Inherit plugins + resolve.alias (incl. the pgn-viewer CSS workaround) from vite.config
// so they never drift between build and test.
export default mergeConfig(
  viteConfig,
  defineConfig({
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
  }),
)
