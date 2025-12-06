import { configDefaults, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/dist/**']
  }
})
