<template>
  <Menu
    ref="menuRef"
    unstyled
    :pt="theme"
    :ptOptions="{
      mergeProps: ptViewMerge
    }"
  >
    <template v-for="(_, slotName) in $slots" v-slot:[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Menu>
</template>

<script setup lang="ts">
import Menu, { type MenuPassThroughOptions, type MenuProps } from 'primevue/menu'
import { ref } from 'vue'
import { ptViewMerge } from './utils'

interface Props extends /* @vue-ignore */ MenuProps {}
defineProps<Props>()

const menuRef = ref<InstanceType<typeof Menu>>()

// Expose all methods from the underlying PrimeVue Menu component
defineExpose({
  toggle: (event: Event, target?: any) => {
    if (menuRef.value && typeof menuRef.value.toggle === 'function') {
      return menuRef.value.toggle(event, target)
    }
  },
  show: (event: Event, target?: any) => {
    if (menuRef.value && typeof menuRef.value.show === 'function') {
      return menuRef.value.show(event, target)
    }
  },
  hide: () => {
    if (menuRef.value && typeof menuRef.value.hide === 'function') {
      return menuRef.value.hide()
    }
  }
})

const theme = ref<MenuPassThroughOptions>({
  root: `
    bg-surface-0 dark:bg-surface-900
    border border-surface-200 dark:border-surface-700
    rounded-md shadow-lg
    py-1 min-w-[12rem]
    focus:outline-none
  `,
  list: `
    list-none m-0 p-0
  `,
  item: `
    relative
  `,
  itemContent: ({ context }) => `
    flex items-center cursor-pointer select-none no-underline overflow-hidden relative
    px-3 py-2 m-1 rounded
    text-surface-700 dark:text-surface-100
    transition-colors duration-200
    ${
      context.focused
        ? 'bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-0'
        : 'hover:bg-surface-100 dark:hover:bg-surface-800'
    }
    ${context.disabled ? 'opacity-60 pointer-events-none' : ''}
  `,
  itemLink: `
    flex items-center flex-1 relative overflow-hidden cursor-pointer select-none no-underline
    text-surface-700 dark:text-surface-100
    py-2 px-3 rounded
    transition-colors duration-200
    hover:bg-surface-100 dark:hover:bg-surface-800
    focus:outline-none focus:outline-offset-0 focus:ring-2 focus:ring-primary-500
  `,
  itemIcon: `
    mr-2 text-surface-600 dark:text-surface-400
  `,
  itemLabel: `
    leading-none
  `,
  separator: `
    border-t border-surface-200 dark:border-surface-700 my-1
  `,
  submenuLabel: `
    py-2 px-3 m-1
    text-xs font-semibold uppercase
    text-surface-600 dark:text-surface-400
  `
})
</script>
