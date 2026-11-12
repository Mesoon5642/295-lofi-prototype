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
    // Testing Library cleanup and the accessibility matcher (see src/test/setup.js).
    setupFiles: ['src/test/setup.js'],
    // Playwright specs in e2e/ run only through `npm run test:e2e`.
    exclude: ['**/node_modules/**', 'dist/**', 'e2e/**'],
  },
})
