import type { CombatDb } from '../db'
import { db } from '../db'
import type { HomebrewEntry } from '../types'

const BACKUP_FORMAT = '5eCombatTool-backup'
export const BACKUP_REMINDER_DAYS = 14

interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: 1
  exportedAt: string
  homebrew: HomebrewEntry[]
}

/** Serializes all homebrew statblocks and PCs and records the export time. */
export async function exportBackup(dbi: CombatDb = db, now = Date.now()): Promise<string> {
  const homebrew = await dbi.homebrew.toArray()
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date(now).toISOString(),
    homebrew,
  }
  await dbi.meta.put({ key: 'lastBackupExport', value: String(now) })
  return JSON.stringify(backup, null, 2)
}

/** Imports a backup file; entries merge by id (existing ids are overwritten). Returns the entry count. */
export async function importBackup(json: string, dbi: CombatDb = db): Promise<number> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  const backup = data as Partial<BackupFile>
  if (backup.format !== BACKUP_FORMAT || !Array.isArray(backup.homebrew)) {
    throw new Error('Not a 5e Combat Tool backup file.')
  }
  for (const entry of backup.homebrew) {
    if (typeof entry.id !== 'string' || typeof entry.statblock?.name !== 'string') {
      throw new Error('Backup contains a malformed homebrew entry.')
    }
  }
  await dbi.homebrew.bulkPut(backup.homebrew)
  return backup.homebrew.length
}

/** True when homebrew exists and the last export is missing or older than 14 days. */
export async function needsBackupReminder(dbi: CombatDb = db, now = Date.now()): Promise<boolean> {
  const count = await dbi.homebrew.count()
  if (count === 0) return false
  const last = await dbi.meta.get('lastBackupExport')
  if (!last) return true
  return now - Number(last.value) > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
