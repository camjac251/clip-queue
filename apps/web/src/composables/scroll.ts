import type { Ref } from 'vue'
import { useScroll, useThrottleFn } from '@vueuse/core'
import { computed, ref } from 'vue'

/**
 * Advanced scroll tracking composable using VueUse
 *
 * Provides reactive scroll position, direction, and utility methods
 * with throttled updates for performance
 *
 * @example
 * const { x, y, isScrolling, directions, isAtTop, isAtBottom, scrollTo } = useAdvancedScroll()
 *
 * // Scroll to position
 * scrollTo({ top: 0, behavior: 'smooth' })
 *
 * // Check scroll direction
 * if (directions.bottom) {
 *   // User scrolling down
 * }
 *
 * @example
 * // Timeline with scroll position
 * const { y, isAtBottom } = useAdvancedScroll(timelineRef)
 *
 * <div ref="timelineRef">
 *   <!-- content -->
 * </div>
 */
export function useAdvancedScroll(target?: Ref<HTMLElement | null | undefined>) {
  const targetElement = target || ref(document.documentElement)

  const { x, y, isScrolling, directions, arrivedState } = useScroll(targetElement, {
    throttle: 100,
    behavior: 'smooth'
  })

  // Derived states
  const isAtTop = computed(() => arrivedState.top)
  const isAtBottom = computed(() => arrivedState.bottom)
  const isAtLeft = computed(() => arrivedState.left)
  const isAtRight = computed(() => arrivedState.right)

  const scrollingDown = computed(() => directions.bottom)
  const scrollingUp = computed(() => directions.top)
  const scrollingLeft = computed(() => directions.left)
  const scrollingRight = computed(() => directions.right)

  // Throttled scroll handler (for custom logic)
  const onScroll = useThrottleFn((callback: () => void) => {
    callback()
  }, 100)

  // Utility: scroll to position
  function scrollTo(options: ScrollToOptions) {
    if (targetElement.value) {
      targetElement.value.scrollTo(options)
    }
  }

  // Utility: scroll to element
  function scrollToElement(element: HTMLElement, options?: ScrollIntoViewOptions) {
    element.scrollIntoView({ behavior: 'smooth', ...options })
  }

  return {
    x,
    y,
    isScrolling,
    directions,
    arrivedState,
    isAtTop,
    isAtBottom,
    isAtLeft,
    isAtRight,
    scrollingDown,
    scrollingUp,
    scrollingLeft,
    scrollingRight,
    onScroll,
    scrollTo,
    scrollToElement
  }
}
