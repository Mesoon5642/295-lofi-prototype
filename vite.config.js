import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Server tests opt into Node with a `// @vitest-environment node` comment.
    environment: 'jsdom',
    // Server tests start an embedded MongoDB, which can take a while the first time.
    hookTimeout: 120_000,
  },
})
