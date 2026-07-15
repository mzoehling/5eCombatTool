import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { clearCacheAndReload } from '../data/clearCache'
import { Modal } from './Modal'

const REPO_URL = 'https://github.com/mzoehling/5eCombatTool'

export function SettingsInfo({ onClose }: { onClose: () => void }) {
  const srdVersion = useLiveQuery(() => db.meta.get('srdDataVersion'), [])

  const clearCache = () => {
    if (!confirm("Clear the app's cached data and reload? Your homebrew, packs and encounters are kept.")) return
    clearCacheAndReload().catch((err: unknown) => console.error('Clear cache failed:', err))
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <section>
        <h3>About</h3>
        <p>5e Combat Tool — an offline-first D&amp;D 5e (2024) initiative &amp; battle tracker.</p>
        <p className="dim">SRD data version: {srdVersion?.value ?? '—'}</p>
        <p>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL}
          </a>
        </p>
      </section>
      <section>
        <h3>Troubleshooting</h3>
        <p className="dim">
          If something looks stuck or out of date after an update, clear the cache and reload. Your homebrew, packs
          and saved encounters are kept.
        </p>
        <button type="button" onClick={clearCache}>
          Clear cache &amp; reload
        </button>
      </section>
    </Modal>
  )
}
