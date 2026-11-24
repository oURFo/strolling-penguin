import { defineConfig } from 'vite'

export default defineConfig({
  base: '/strolling-penguin/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
        },
      },
    },
  },
})
