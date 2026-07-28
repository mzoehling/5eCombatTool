import { mdiClose } from '@mdi/js'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportBackup, needsBackupReminder, setBackupReminderOff } from '../data/backup'
import { Icon } from './Icon'

/** Unobtrusive banner shown when homebrew exists and the last export is > 14 days old. */
export function BackupReminder() {
  const due = useLiveQuery(() => needsBackupReminder(), [], false)
  const [dismissed, setDismissed] = useState(false)

  if (!due || dismissed) return null

  const doExport = async () => {
    const json = await exportBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `5eCombatTool-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-banner" role="status">
      <span>Your homebrew hasn't been backed up recently.</span>
      <button type="button" className="primary" onClick={doExport}>
        Export now
      </button>
      {/* Persistent opt-out; `due` re-runs off the meta row, so the banner
          disappears on its own. Reversible in Settings. */}
      <button
        type="button"
        title="Stop showing this reminder — you can turn it back on in Settings"
        onClick={() => setBackupReminderOff(true)}
      >
        Ignore
      </button>
      <button
        type="button"
        className="ghost"
        aria-label="Dismiss reminder until next launch"
        onClick={() => setDismissed(true)}
      >
        <Icon path={mdiClose} />
      </button>
    </div>
  )
}
