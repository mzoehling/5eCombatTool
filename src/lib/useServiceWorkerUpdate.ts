import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Registers the service worker and reports when a newer build is waiting.
 *
 * `vite.config.ts` sets `injectRegister: false` and `registerType: 'prompt'`,
 * so the app is the only thing that registers the worker — whichever component
 * calls this hook. That made the Player View a dead end: it renders its own
 * root, never mounted the DM app's banner, and so served whatever build it had
 * precached forever. A second screen left on `#/play/{code}` between sessions
 * is exactly the device that goes stale, and the one least likely to have
 * someone thinking about reloading it.
 *
 * Both roots call this now. It polls every 15 minutes and whenever the tab
 * becomes visible, which is when a viewer picked back up mid-session checks.
 */
export function useServiceWorkerUpdate(): { needRefresh: boolean; reload: () => void } {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
      registration?.update().catch(() => {})
    },
  })

  useEffect(() => {
    const check = () => registrationRef.current?.update().catch(() => {})
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { needRefresh, reload: () => updateServiceWorker(true) }
}
