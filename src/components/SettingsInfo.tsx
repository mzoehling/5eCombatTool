import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BACKUP_REMINDER_DAYS, isBackupReminderOff, setBackupReminderOff } from '../data/backup'
import { clearCacheAndReload } from '../data/clearCache'
import { Modal } from './Modal'

const REPO_URL = 'https://github.com/mzoehling/5eCombatTool'

export function SettingsInfo({ onClose }: { onClose: () => void }) {
  const srdVersion = useLiveQuery(() => db.meta.get('srdDataVersion'), [])
  const reminderOff = useLiveQuery(() => isBackupReminderOff(), [], false)

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
        <h3>Backups</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={reminderOff}
            onChange={(e) => setBackupReminderOff(e.target.checked)}
          />
          Ignore backup reminders
        </label>
        <p className="dim">
          When unchecked, a banner appears if your homebrew hasn&rsquo;t been exported in the last{' '}
          {BACKUP_REMINDER_DAYS} days.
        </p>
      </section>
      <section>
        <h3>Troubleshooting</h3>
        <p className="dim">
          If something looks stuck or out of date after an update, clear the cache and reload. Your homebrew, packs
          and saved encounters are kept.
        </p>
        <button type="button" className="warn" onClick={clearCache}>
          Clear cache &amp; reload
        </button>
      </section>
    </Modal>
  )
}
