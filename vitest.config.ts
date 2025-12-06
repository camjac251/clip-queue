import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    projects: ['apps/*', 'packages/*'],
    // Vitest 4.0 changed default excludes - use configDefaults.exclude plus dist
    exclude: [...configDefaults.exclude, '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['apps/**', 'packages/**'],
      exclude: [
        '**/*.config.js',
        '**/*.d.ts',
        'packages/config/**',
        'packages/ui/src/primevue/presets/**'
      ]
    }
  }
})
