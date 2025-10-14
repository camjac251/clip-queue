import { createTestingPinia } from '@pinia/testing'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QueueSettings from '../QueueSettings.vue'

describe('QueueSettings.vue', () => {
  const wrapper = shallowMount(QueueSettings, {
    global: {
      plugins: [createTestingPinia()]
    }
  })

  it('mounts successfully', () => {
    expect(wrapper.exists()).toEqual(true)
  })
})
