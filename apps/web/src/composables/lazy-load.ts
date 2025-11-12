import type { Ref } from 'vue'
import { useElementVisibility } from '@vueuse/core'
import { ref } from 'vue'

/**
 * Lazy loading composable using VueUse element visibility
 *
 * Defers loading content until element becomes visible in viewport
 * Perfect for timeline clips, images, or heavy components
 *
 * @example
 * // In component
 * const { targetRef, isVisible, hasBeenVisible } = useLazyLoad()
 *
 * // In template
 * <div ref="targetRef">
 *   <component v-if="hasBeenVisible" />
 *   <div v-else>Loading...</div>
 * </div>
 *
 * @example
 * // Timeline clip with lazy loading
 * const { targetRef, hasBeenVisible } = useLazyLoad()
 *
 * <div ref="targetRef">
 *   <img v-if="hasBeenVisible" :src="clip.thumbnailUrl" />
 *   <div v-else class="skeleton" />
 * </div>
 */
export function useLazyLoad() {
  const targetRef = ref<HTMLElement | null>(null)
  const isVisible = useElementVisibility(targetRef)

  // Track if element has ever been visible (useful for one-time loading)
  const hasBeenVisible = ref(false)

  // Watch for visibility and mark as seen
  // This prevents unloading content when scrolling past
  if (!hasBeenVisible.value && isVisible.value) {
    hasBeenVisible.value = true
  }

  return {
    targetRef: targetRef as Ref<HTMLElement | null>,
    isVisible,
    hasBeenVisible
  }
}
