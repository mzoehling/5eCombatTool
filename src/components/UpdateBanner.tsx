import { useServiceWorkerUpdate } from '../lib/useServiceWorkerUpdate'

/** Prompts for a reload when a new service worker is installed. The polling
 *  and registration live in the hook, which the Player View shares. */
export function UpdateBanner() {
  const { needRefresh, reload } = useServiceWorkerUpdate()

  if (!needRefresh) return null

  return (
    <div className="app-banner accent" role="status">
      <span>A new version is available.</span>
      <button type="button" className="primary" onClick={reload}>
        Reload
      </button>
    </div>
  )
}
