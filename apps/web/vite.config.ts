import { fileURLToPath, URL } from 'node:url'

import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from apps/web directory (not monorepo root)
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, envDir, '')

  return {
    envDir, // Tell Vite where to load client-side VITE_* vars from
    plugins: [
      paraglideVitePlugin({
        project: fileURLToPath(new URL('./project.inlang', import.meta.url)),
        outdir: fileURLToPath(new URL('./src/paraglide', import.meta.url))
      }),
      tailwindcss(),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('media-')
          }
        }
      }),
      Icons({
        compiler: 'vue3',
        autoInstall: true
      })
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: env.VITE_PORT ? parseInt(env.VITE_PORT) : 5173
    }
  }
})
