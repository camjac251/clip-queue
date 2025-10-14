import { ref } from 'vue'

const isCollapsed = ref(false)

export function useSidebar() {
  function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value
  }

  return {
    isCollapsed,
    toggleCollapse
  }
}
