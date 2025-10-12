import { createTestingPinia } from '@pinia/testing'
import { shallowMount } from '@vue/test-utils'
import ToastService from 'primevue/toastservice'
import { describe, expect, it } from 'vitest'

import App from '@/App.vue'

describe('App.vue', () => {
  const wrapper = shallowMount(App, {
    global: {
      plugins: [createTestingPinia(), ToastService]
    }
  })

  it('mounts successfully', () => {
    expect(wrapper.exists()).toEqual(true)
  })
})
