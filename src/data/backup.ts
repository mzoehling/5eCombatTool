import type { CombatDb } from '../db'
import { db } from '../db'
import type { Battle, Combatant, ContentPack, HomebrewEntry, SavedEncounter } from '../types'

const BACKUP_FORMAT = '5eCombatTool-backup'
export const BACKUP_REMINDER_DAYS = 14

interface BackupFile {
  format: typeof BACKUP_FORMAT
  /** 1: homebrew only. 2: adds packs, saved encounters and the current battle. */
  version: 1 | 2
  exportedAt: string
  homebrew: HomebrewEntry[]
  packs?: ContentPack[]
  encounters?: SavedEncounter[]
  combatants?: Combatant[]
  battle?: Battle | null
}

export interface ImportSummary {
  homebrew: number
  packs: number
  encounters: number
  /** True when the backup's battle replaced the (empty) tracker. */
  battleRestored: boolean
}

/** Serializes homebrew, imported packs and the current battle; records the export time. */
export async function exportBackup(dbi: CombatDb = db, now = Date.now()): Promise<string> {
  const [homebrew, packs, encounters, combatants, battle] = await Promise.all([
    dbi.homebrew.toArray(),
    dbi.packs.toArray(),
    dbi.encounters.toArray(),
    dbi.combatants.toArray(),
    dbi.battle.get('current'),
  ])
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: 2,
    exportedAt: new Date(now).toISOString(),
    homebrew,
    packs,
    encounters,
    combatants,
    battle: battle ?? null,
  }
  await dbi.meta.put({ key: 'lastBackupExport', value: String(now) })
  return JSON.stringify(backup, null, 2)
}

/**
 * Imports a backup file (v1 or v2). Homebrew and packs merge by id (existing
 * ids are overwritten). The battle is restored only when the tracker is
 * currently empty — a running encounter is never silently replaced.
 */
export async function importBackup(json: string, dbi: CombatDb = db): Promise<ImportSummary> {
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
  const homebrew = backup.homebrew
  const packs = (backup.packs ?? []).filter((p) => typeof p?.packId === 'string')
  const encounters = (backup.encounters ?? []).filter((e) => typeof e?.id === 'string' && Array.isArray(e.combatants))
  const combatants = Array.isArray(backup.combatants) ? backup.combatants : []

  let battleRestored = false
  await dbi.transaction('rw', [dbi.homebrew, dbi.packs, dbi.encounters, dbi.combatants, dbi.battle], async () => {
    await dbi.homebrew.bulkPut(homebrew)
    if (packs.length) await dbi.packs.bulkPut(packs)
    if (encounters.length) await dbi.encounters.bulkPut(encounters)
    if (backup.battle && combatants.length && (await dbi.combatants.count()) === 0) {
      await dbi.combatants.bulkPut(combatants)
      await dbi.battle.put(backup.battle)
      battleRestored = true
    }
  })
  return { homebrew: homebrew.length, packs: packs.length, encounters: encounters.length, battleRestored }
}

/** True when homebrew exists and the last export is missing or older than 14 days. */
export async function needsBackupReminder(dbi: CombatDb = db, now = Date.now()): Promise<boolean> {
  const count = await dbi.homebrew.count()
  if (count === 0) return false
  const last = await dbi.meta.get('lastBackupExport')
  if (!last) return true
  return now - Number(last.value) > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
