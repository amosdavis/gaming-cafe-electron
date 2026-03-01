import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index:   resolve('src/main/index.js'),
          db:      resolve('src/main/db.js'),
          ipc:     resolve('src/main/ipc.js'),
          launcher:resolve('src/main/launcher.js'),
          scanner: resolve('src/main/scanner.js'),
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()]
  }
})
