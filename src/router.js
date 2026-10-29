import { createBrowserRouter, redirect } from 'react-router'
import {
  childLoader,
  chooseLoader,
  parentChildLoader,
  parentHomeLoader,
  playLoader,
  playersLoader,
  rootLoader,
  signInLoader,
  summaryLoader,
} from './routes/loaders.js'
import {
  AppLayout,
  ChildLayout,
  ChooseRoute,
  ErrorScreen,
  LoadingScreen,
  ParentChildRoute,
  ParentHomeRoute,
  PlayRoute,
  PlayersRoute,
  SignInRoute,
  StartRoute,
  SummaryRoute,
} from './routes/routeComponents.jsx'

// Routes:
//   /sign-in            grown-up sign-in for this device (when signed out)
//   /players            Who's playing? (grown-up: pick a child, add one, or open the parent view)
//   /parent             parent/teacher view: every child, add a child, switch player, sign out
//   /parent/:childId    one child's results and reading settings
//   /                   Start (for the child playing on this device)
//   /games              Choose a game
//   /play/:roundId      a round in progress
//   /summary/:roundId   a finished round
// Grown-up screens ask for the password again when their unlock has timed out.
export const router = createBrowserRouter([
  {
    path: '/sign-in',
    loader: signInLoader,
    Component: SignInRoute,
    ErrorBoundary: ErrorScreen,
    HydrateFallback: LoadingScreen,
  },
  {
    id: 'root',
    path: '/',
    loader: rootLoader,
    Component: AppLayout,
    ErrorBoundary: ErrorScreen,
    HydrateFallback: LoadingScreen,
    children: [
      { path: 'players', loader: playersLoader, Component: PlayersRoute },
      { path: 'parent', loader: parentHomeLoader, Component: ParentHomeRoute },
      { path: 'parent/:childId', loader: parentChildLoader, Component: ParentChildRoute },
      {
        id: 'child',
        loader: childLoader,
        Component: ChildLayout,
        children: [
          { index: true, Component: StartRoute },
          { path: 'games', loader: chooseLoader, Component: ChooseRoute },
          { path: 'play/:roundId', loader: playLoader, Component: PlayRoute },
          { path: 'summary/:roundId', loader: summaryLoader, Component: SummaryRoute },
        ],
      },
      { path: '*', loader: () => redirect('/') },
    ],
  },
])
