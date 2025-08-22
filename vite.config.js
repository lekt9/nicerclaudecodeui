import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  const isElectronMode = mode === 'electron'
  
  return {
    plugins: [
      react(),
      ...(isElectronMode ? [
        electron({
          main: {
            entry: 'electron/main.js',
            onstart: (options) => {
              if (options.startup) {
                options.startup(['--inspect=5858', ...options.startup])
              }
            },
            vite: {
              build: {
                sourcemap: true,
                minify: false,
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron']
                }
              }
            }
          },
          preload: {
            input: 'electron/preload.js',
            vite: {
              build: {
                sourcemap: 'inline',
                minify: false,
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron']
                }
              }
            }
          },
          renderer: {}
        })
      ] : [])
    ],
    define: {
      __IS_ELECTRON__: isElectronMode
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      ...(isElectronMode ? {} : {
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3002}`,
          ws: true
        }
      }
      })
    },
    build: {
      outDir: 'dist',
      emptyOutDir: !isElectronMode
    }
  }
})