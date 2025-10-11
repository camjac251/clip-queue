import { fileURLToPath, URL } from 'node:url'

import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: fileURLToPath(new URL('./project.inlang', import.meta.url)),
      outdir: fileURLToPath(new URL('./src/paraglide', import.meta.url))
    }),
    tailwindcss(),
    vue()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
