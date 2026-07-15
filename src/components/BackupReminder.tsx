import { mdiClose } from '@mdi/js'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportBackup, needsBackupReminder } from '../data/backup'
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
      <button type="button" className="ghost" aria-label="Dismiss reminder" onClick={() => setDismissed(true)}>
        <Icon path={mdiClose} />
      </button>
    </div>
  )
}
