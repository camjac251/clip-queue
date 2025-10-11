import { createTestingPinia } from '@pinia/testing'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { Platform } from '@cq/platforms'

import PlatformName from '../PlatformName.vue'

describe('PlatformName.vue', () => {
  const wrapper = shallowMount(PlatformName, {
    props: {
      platform: Platform.TWITCH
    },
    global: {
      plugins: [createTestingPinia()]
    }
  })

  it('mounts successfully', () => {
    expect(wrapper.exists()).toEqual(true)
  })
})
