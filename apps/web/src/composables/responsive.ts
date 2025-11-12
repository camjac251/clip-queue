import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

/**
 * Responsive breakpoint composable using VueUse
 *
 * Provides reactive breakpoint detection for responsive UI
 * Based on Tailwind CSS default breakpoints
 *
 * @example
 * const { width, height, isSmall, isMedium, isLarge, isXLarge } = useResponsive()
 *
 * // Conditional rendering
 * <div v-if="isSmall">Mobile View</div>
 * <div v-else-if="isMedium">Tablet View</div>
 * <div v-else>Desktop View</div>
 */
export function useResponsive() {
  const { width, height } = useWindowSize()

  const isSmall = computed(() => width.value >= 640) // sm: 640px
  const isMedium = computed(() => width.value >= 768) // md: 768px
  const isLarge = computed(() => width.value >= 1024) // lg: 1024px
  const isXLarge = computed(() => width.value >= 1280) // xl: 1280px
  const is2XLarge = computed(() => width.value >= 1536) // 2xl: 1536px

  // Inverse checks (for max-width)
  const isMobileOnly = computed(() => width.value < 640)
  const isTabletOrBelow = computed(() => width.value < 1024)
  const isDesktopOrBelow = computed(() => width.value < 1280)

  return {
    width,
    height,
    isSmall,
    isMedium,
    isLarge,
    isXLarge,
    is2XLarge,
    isMobileOnly,
    isTabletOrBelow,
    isDesktopOrBelow
  }
}
