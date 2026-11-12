// Runs before every test file (vite.config.js `setupFiles`), in jsdom and in Node.
// Not a mock: it only registers the accessibility matcher and unmounts React trees
// between tests (Vitest globals are off, so Testing Library can't do it by itself).
import { afterEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

expect.extend(axeMatchers)

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())
}
