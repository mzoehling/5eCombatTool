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
// The flag lives outside the component so the load starts before the first paint
// on a cold entry, and still runs exactly once under StrictMode.
let srdRequested = false

function ensureSrd(): void {
  if (srdRequested) return
  srdRequested = true
  ensureSrdData().catch((err: unknown) => console.error('SRD data load failed:', err))
}

if (initial.view === 'app') ensureSrd()

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

  // Reaching the DM app from a player route is now possible — the back button out
  // of the same-device viewer does it — and it must not mount the tracker against
  // an empty compendium.
  useEffect(() => {
    if (route.view === 'app') ensureSrd()
  }, [route.view])

  if (route.view === 'play') return <ViewerApp code={route.code} />
  if (route.view === 'join') return <JoinScreen />
  return <App />
}
