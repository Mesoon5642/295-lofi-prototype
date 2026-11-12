// Renders real screens inside a real (memory) router and the child's SettingsContext,
// for component and accessibility tests. Screens get their data and callbacks as
// props, so tests pass hand-written stand-ins instead of mocking modules.
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { SettingsContext } from '../components/settingsContext.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'

// `element` is shown at `path`; `routes` adds more routes (e.g. where Back goes).
// Resolves with Testing Library's result plus `user` (user-event) and `router`.
export function renderWithRouter(
  element,
  { path = '/', initialEntries = [path], routes = [], settings = DEFAULT_SETTINGS } = {},
) {
  const router = createMemoryRouter([{ path, element }, ...routes], { initialEntries })
  const settingsValue = { childId: 'child-alex', settings, updateSettings: () => {} }
  const user = userEvent.setup()
  const result = render(
    <SettingsContext value={settingsValue}>
      <div className="app" data-text-size={settings.textSize} data-font={settings.font}>
        <RouterProvider router={router} />
      </div>
    </SettingsContext>,
  )
  return { ...result, user, router }
}
