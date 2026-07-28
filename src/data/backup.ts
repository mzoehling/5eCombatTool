import type { CombatDb } from '../db'
import { db } from '../db'
import { HOMEBREW_PACK_ID, type Battle, type Combatant, type ContentPack, type SavedEncounter } from '../types'
import { getHomebrewPack, homebrewCount, mergeHomebrew } from './homebrewPack'
import { validatePackEntries } from './packs'

const BACKUP_FORMAT = '5eCombatTool-backup'
export const BACKUP_REMINDER_DAYS = 14

interface BackupFile {
  format: typeof BACKUP_FORMAT
  /** 3 is the only supported version. Versions 1 and 2 carried homebrew in a
   *  section of its own; they are rejected rather than read, so an old file is
   *  refused with a message instead of misread as the current shape. */
  version: 3
  exportedAt: string
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
  const [packs, encounters, combatants, battle] = await Promise.all([
    dbi.packs.toArray(),
    dbi.encounters.toArray(),
    dbi.combatants.toArray(),
    dbi.battle.get('current'),
  ])
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: 3,
    exportedAt: new Date(now).toISOString(),
    // Homebrew is one of the packs now; there is no separate section to write.
    packs,
    encounters,
    combatants,
    battle: battle ?? null,
  }
  await dbi.meta.put({ key: 'lastBackupExport', value: String(now) })
  return JSON.stringify(backup, null, 2)
}

/**
 * Imports a version 3 backup file. Packs and encounters merge by id (existing
 * ids are overwritten), and the homebrew pack merges entry by entry so
 * restoring an old backup adds to what the user has rather than replacing it.
 * The battle is restored only when the tracker is currently empty — a running
 * encounter is never silently replaced.
 */
export async function importBackup(json: string, dbi: CombatDb = db): Promise<ImportSummary> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  // Checked before anything is read out of it: a non-object (or an array, or
  // null) would otherwise blow up with a raw TypeError on the first property
  // access rather than reaching the message below.
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Not a 5e Combat Tool backup file.')
  }
  const backup = data as Partial<BackupFile>
  if (backup.format !== BACKUP_FORMAT) {
    throw new Error('Not a 5e Combat Tool backup file.')
  }
  if (backup.version !== 3) {
    throw new Error(
      `Backup version ${String(backup.version)} is no longer supported. Only version 3 backups can be imported.`,
    )
  }
  if (backup.packs !== undefined && !Array.isArray(backup.packs)) {
    throw new Error('"packs" must be an array.')
  }

  const allPacks = (backup.packs ?? []).filter((p) => typeof p?.packId === 'string')
  // Every pack gets the same shape check the file picker applies — including
  // the homebrew pack, which used to be merged with no check at all.
  for (const pack of allPacks) validatePackEntries(pack as unknown as Record<string, unknown>)
  // The Homebrew pack never goes through bulkPut — it is merged below so an old
  // backup cannot wipe content authored since it was taken.
  const packs = allPacks.filter((p) => p.packId !== HOMEBREW_PACK_ID)
  const incomingHomebrew = allPacks.find((p) => p.packId === HOMEBREW_PACK_ID)
  const homebrewMonsters = incomingHomebrew?.monsters ?? []
  const homebrewPcs = incomingHomebrew?.pcs ?? []

  const encounters = (backup.encounters ?? []).filter((e) => typeof e?.id === 'string' && Array.isArray(e.combatants))
  const combatants = Array.isArray(backup.combatants) ? backup.combatants : []

  let battleRestored = false
  await dbi.transaction('rw', [dbi.packs, dbi.encounters, dbi.combatants, dbi.battle], async () => {
    if (homebrewMonsters.length || homebrewPcs.length) {
      let pack = await getHomebrewPack(dbi)
      pack = mergeHomebrew(pack, 'monsters', homebrewMonsters)
      pack = mergeHomebrew(pack, 'pcs', homebrewPcs)
      await dbi.packs.put(pack)
    }
    if (packs.length) await dbi.packs.bulkPut(packs)
    if (encounters.length) await dbi.encounters.bulkPut(encounters)
    if (backup.battle && combatants.length && (await dbi.combatants.count()) === 0) {
      await dbi.combatants.bulkPut(combatants)
      await dbi.battle.put(backup.battle)
      battleRestored = true
    }
  })
  return {
    homebrew: homebrewMonsters.length + homebrewPcs.length,
    packs: packs.length,
    encounters: encounters.length,
    battleRestored,
  }
}

/** Meta row set when the user opts out of the backup reminder for good. */
const BACKUP_REMINDER_OFF_KEY = 'backupReminderOff'

/** True when the user turned the backup reminder off (banner "Ignore", or the
 *  matching checkbox in Settings — both write this one row). */
export async function isBackupReminderOff(dbi: CombatDb = db): Promise<boolean> {
  return (await dbi.meta.get(BACKUP_REMINDER_OFF_KEY)) !== undefined
}

export async function setBackupReminderOff(off: boolean, dbi: CombatDb = db): Promise<void> {
  if (off) await dbi.meta.put({ key: BACKUP_REMINDER_OFF_KEY, value: '1' })
  else await dbi.meta.delete(BACKUP_REMINDER_OFF_KEY)
}

/** True when homebrew exists and the last export is missing or older than 14 days. */
export async function needsBackupReminder(dbi: CombatDb = db, now = Date.now()): Promise<boolean> {
  if (await isBackupReminderOff(dbi)) return false
  // Only app-authored content is worth nagging about — imported packs can be
  // imported again from the file they came from.
  if ((await homebrewCount(dbi)) === 0) return false
  const last = await dbi.meta.get('lastBackupExport')
  if (!last) return true
  return now - Number(last.value) > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
