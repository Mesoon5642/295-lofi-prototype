import { defineConfig, devices } from '@playwright/test'

// End-to-end tests in a real browser against the running app: `npm run test:e2e`.
// They are kept out of `npm test` (see vite.config.js). The API runs on its own
// embedded MongoDB in .data/e2e, and each test resets the demo data first, so the
// tests run one at a time.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm start',
      url: 'http://localhost:3001/api/health',
      env: { MONGODB_DATA_DIR: '.data/e2e', PORT: '3001' },
      reuseExistingServer: !process.env.CI,
      // The first run downloads a MongoDB binary.
      timeout: 180_000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
