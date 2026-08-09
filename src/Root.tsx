import { useEffect, useState } from 'react'
import App from './App.tsx'
import { ensureSrdData } from './data/loadSrd.ts'
import { JoinScreen } from './features/playerView/JoinScreen.tsx'
import { ViewerApp } from './features/playerView/ViewerApp.tsx'

// `#/play/{code}` renders the read-only Player View, `#/play` its code entry.
const PLAY_ROUTE = /^#\/play(?:\/([A-Za-z0-9]*))?\/?$/

type Route = { view: 'app' } | { view: 'join' } | { view: 'play'; code: string }

function routeOf(hash: string): Route {
  const match = PLAY_ROUTE.exec(hash)
  if (!match) return { view: 'app' }
  return match[1] ? { view: 'play', code: match[1] } : { view: 'join' }
}

const initial = routeOf(location.hash)

// The DM app needs the bundled SRD in Dexie; a player's screen never touches it.
// This stays outside the component so it starts before the first paint and runs
// exactly once, rather than twice under StrictMode.
if (initial.view === 'app') {
  ensureSrdData().catch((err: unknown) => console.error('SRD data load failed:', err))
}

/**
 * The route is read on every hash change, not once at load. It used to be
 * matched a single time, which was invisible while the only way in was a fresh
 * URL — but a player who typed a code, or came back from one to correct it, would
 * have had to reload the whole app before being shown anything.
 */
export function Root() {
  const [route, setRoute] = useState<Route>(initial)

  useEffect(() => {
    const onHashChange = () => setRoute(routeOf(location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route.view === 'play') return <ViewerApp code={route.code} />
  if (route.view === 'join') return <JoinScreen />
  return <App />
}
