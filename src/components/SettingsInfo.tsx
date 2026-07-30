import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../db'
import {
  BACKUP_REMINDER_DAYS,
  exportBackup,
  importBackup,
  isBackupReminderOff,
  setBackupReminderOff,
} from '../data/backup'
import { clearCacheAndReload } from '../data/clearCache'
import { battleStore } from '../store/battleStore'
import { Checkbox } from './Checkbox'
import { Modal } from './Modal'

const REPO_URL = 'https://github.com/mzoehling/5eCombatTool'

export function SettingsInfo({ onClose }: { onClose: () => void }) {
  const srdVersion = useLiveQuery(() => db.meta.get('srdDataVersion'), [])
  const reminderOff = useLiveQuery(() => isBackupReminderOff(), [], false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    const json = await exportBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `5eCombatTool-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ text: 'Backup exported.' })
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const summary = await importBackup(await file.text())
      if (summary.battleRestored) await battleStore.hydrate()
      const parts = [`${summary.homebrew} homebrew entries`]
      if (summary.packs) parts.push(`${summary.packs} packs`)
      if (summary.encounters) parts.push(`${summary.encounters} encounters`)
      if (summary.battleRestored) parts.push('the saved battle')
      setMessage({ text: `Imported ${parts.join(', ')}.` })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const clearCache = () => {
    if (!confirm("Clear the app's cached data and reload? Your homebrew, packs and encounters are kept.")) return
    clearCacheAndReload().catch((err: unknown) => console.error('Clear cache failed:', err))
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <section>
        <h3 className="section-heading">About</h3>
        <p>5e Combat Tool — an offline-first D&amp;D 5e (2024) initiative &amp; battle tracker.</p>
        <p className="dim">SRD data version: {srdVersion?.value ?? '—'}</p>
        <p>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL}
          </a>
        </p>
      </section>
      <section>
        <h3 className="section-heading">Backups</h3>
        <p className="dim">
          A backup holds your homebrew, imported packs, saved encounters and the current battle. Importing merges
          into what you already have; a running battle is never replaced.
        </p>
        <div className="settings-actions">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => doImport(e.target.files?.[0])}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import backup…
          </button>
          <button type="button" onClick={doExport}>
            Export backup
          </button>
        </div>
        {message && <p className={message.error ? 'error-text' : 'ok-text'}>{message.text}</p>}
        <label className="check">
          <Checkbox
            checked={reminderOff}
            onChange={() => setBackupReminderOff(!reminderOff)}
            ariaLabel="Ignore backup reminders"
          />
          Ignore backup reminders
        </label>
        <p className="dim">
          When unchecked, a banner appears if your homebrew hasn&rsquo;t been exported in the last{' '}
          {BACKUP_REMINDER_DAYS} days.
        </p>
      </section>
      <section>
        <h3 className="section-heading">Troubleshooting</h3>
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
