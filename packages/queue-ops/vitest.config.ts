import { configDefaults, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/dist/**']
  }
})
