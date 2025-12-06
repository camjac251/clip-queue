import { fileURLToPath } from 'node:url'

import { configDefaults, defineProject, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineProject({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/__tests__/setup.js'],
      exclude: [...configDefaults.exclude, 'e2e/*', '**/dist/**'],
      root: fileURLToPath(new URL('./', import.meta.url))
    }
  })
)
