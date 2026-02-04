import { defineConfig } from 'vite'

export default defineConfig({
  base: '/story-quiz/',
  server: {
    port: 5173,
    host: 'localhost'
  }
})
