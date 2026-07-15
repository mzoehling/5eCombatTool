import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 15 * 60 * 1000

/** Prompts for a reload when a new service worker is installed; polls for updates every 15 min and on tab focus. */
export function UpdateBanner() {
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

  if (!needRefresh) return null

  return (
    <div className="app-banner" role="status">
      <span>A new version is available.</span>
      <button type="button" className="primary" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
    </div>
  )
}
