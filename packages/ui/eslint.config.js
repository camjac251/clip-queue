import vue from '@cq/config/eslint/vue'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['src/volt']
  },
  ...vue,
  {
    files: ['src/components/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off'
    }
  }
]
