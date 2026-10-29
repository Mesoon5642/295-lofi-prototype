import { createBrowserRouter, redirect } from 'react-router'
import {
  chooseLoader,
  parentLoader,
  playLoader,
  rootLoader,
  signInLoader,
  summaryLoader,
} from './routes/loaders.js'
import {
  AppLayout,
  ChooseRoute,
  ErrorScreen,
  LoadingScreen,
  ParentRoute,
  PlayRoute,
  SignInRoute,
  StartRoute,
  SummaryRoute,
} from './routes/routeComponents.jsx'

// Routes:
//   /sign-in            grown-up sign-in for this device (when signed out)
//   /                   Start
//   /games              Choose a game
//   /play/:roundId      a round in progress
//   /summary/:roundId   a finished round
//   /parent             parent/teacher view (only after re-entering the password)
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
      { index: true, Component: StartRoute },
      { path: 'games', loader: chooseLoader, Component: ChooseRoute },
      { path: 'play/:roundId', loader: playLoader, Component: PlayRoute },
      { path: 'summary/:roundId', loader: summaryLoader, Component: SummaryRoute },
      { path: 'parent', loader: parentLoader, Component: ParentRoute },
      { path: '*', loader: () => redirect('/') },
    ],
  },
])
