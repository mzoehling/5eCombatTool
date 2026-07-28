import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { emptyForm, formToStatblock } from '../lib/homebrewForm'
import { HOMEBREW_PACK_ID, type HomebrewEntry, type Statblock } from '../types'
import {
  exportBackup,
  importBackup,
  isBackupReminderOff,
  needsBackupReminder,
  setBackupReminderOff,
} from './backup'
import { saveHomebrewEntry } from './homebrewPack'

const DAY = 24 * 60 * 60 * 1000

function makeStatblock(name: string): Statblock {
  return formToStatblock({ ...emptyForm, name }, `hb-${name.toLowerCase()}`)
}

/** A pre-v4 homebrew row, as it still appears in version 1 and 2 backup files. */
function makeEntry(name: string): HomebrewEntry {
  const id = `hb-${name.toLowerCase()}`
  return { id, kind: 'monster', statblock: makeStatblock(name), createdAt: 1, updatedAt: 1 }
}

describe('backup', () => {
  it('round-trips homebrew, packs and the battle through export/import', async () => {
    const source = new CombatDb(`test-${crypto.randomUUID()}`)
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await saveHomebrewEntry('monsters', makeStatblock('Alpha'), source)
      await saveHomebrewEntry('pcs', makeStatblock('Beta'), source)
      await source.packs.put({ packId: 'p1', name: 'Pack One', version: '1', monsters: [] })
      await source.combatants.put({
        id: 'c1',
        name: 'Goblin',
        hp: 7,
        maxHp: 7,
        tempHp: 0,
        armorClass: 15,
        initiative: 12,
        initiativeBonus: 2,
        sortIndex: 0,
        isActive: true,
        isPC: false,
        hiddenFromPlayers: false,
        conditions: [],
        limits: [],
      })
      await source.battle.put({ id: 'current', round: 3, activeCombatantId: 'c1', isRunning: true, groups: [] })
      const json = await exportBackup(source)

      const summary = await importBackup(json, target)
      expect(summary).toEqual({ homebrew: 2, packs: 1, encounters: 0, battleRestored: true })
      const homebrew = await target.packs.get(HOMEBREW_PACK_ID)
      expect(homebrew?.monsters?.map((m) => m.name)).toEqual(['Alpha'])
      expect(homebrew?.pcs?.map((p) => p.name)).toEqual(['Beta'])
      expect((await target.packs.get('p1'))?.name).toBe('Pack One')
      expect((await target.battle.get('current'))?.round).toBe(3)
      expect(await target.combatants.count()).toBe(1)
    } finally {
      await source.delete()
      await target.delete()
    }
  })

  it('never replaces a non-empty tracker with the backup battle', async () => {
    const source = new CombatDb(`test-${crypto.randomUUID()}`)
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    const combatant = {
      id: 'c1',
      name: 'Goblin',
      hp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 15,
      initiative: 12,
      initiativeBonus: 2,
      sortIndex: 0,
      isActive: true,
      isPC: false,
      hiddenFromPlayers: false,
      conditions: [],
      limits: [],
    }
    try {
      await source.combatants.put(combatant)
      await source.battle.put({ id: 'current', round: 3, activeCombatantId: 'c1', isRunning: true, groups: [] })
      const json = await exportBackup(source)

      await target.combatants.put({ ...combatant, id: 'existing', name: 'Ogre' })
      const summary = await importBackup(json, target)
      expect(summary.battleRestored).toBe(false)
      expect(await target.combatants.count()).toBe(1)
      expect((await target.combatants.toArray())[0].name).toBe('Ogre')
    } finally {
      await source.delete()
      await target.delete()
    }
  })

  it('imports legacy v1 backups (homebrew only)', async () => {
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      const v1 = JSON.stringify({
        format: '5eCombatTool-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        homebrew: [makeEntry('Alpha')],
      })
      const summary = await importBackup(v1, target)
      expect(summary).toEqual({ homebrew: 1, packs: 0, encounters: 0, battleRestored: false })
      expect((await target.packs.get(HOMEBREW_PACK_ID))?.monsters?.map((m) => m.name)).toEqual(['Alpha'])
    } finally {
      await target.delete()
    }
  })

  it('splits legacy homebrew into the monsters and PCs sections by kind', async () => {
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      const v2 = JSON.stringify({
        format: '5eCombatTool-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        homebrew: [makeEntry('Alpha'), { ...makeEntry('Thoric'), kind: 'pc' }],
      })
      await importBackup(v2, target)
      const pack = await target.packs.get(HOMEBREW_PACK_ID)
      expect(pack?.monsters?.map((m) => m.name)).toEqual(['Alpha'])
      expect(pack?.pcs?.map((p) => p.name)).toEqual(['Thoric'])
    } finally {
      await target.delete()
    }
  })

  it('merges an imported backup into existing homebrew rather than replacing it', async () => {
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      // Content authored since the backup was taken must survive the restore.
      await saveHomebrewEntry('monsters', makeStatblock('Newer'), target)
      const v1 = JSON.stringify({
        format: '5eCombatTool-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        homebrew: [makeEntry('Alpha')],
      })
      await importBackup(v1, target)
      const names = (await target.packs.get(HOMEBREW_PACK_ID))?.monsters?.map((m) => m.name)
      expect(names?.sort()).toEqual(['Alpha', 'Newer'])
    } finally {
      await target.delete()
    }
  })

  it('replaces a homebrew entry the backup also has, without duplicating it', async () => {
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await saveHomebrewEntry('monsters', { ...makeStatblock('Alpha'), ac: 99 }, target)
      const v1 = JSON.stringify({
        format: '5eCombatTool-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        homebrew: [makeEntry('Alpha')],
      })
      await importBackup(v1, target)
      const monsters = (await target.packs.get(HOMEBREW_PACK_ID))?.monsters
      expect(monsters).toHaveLength(1)
      expect(monsters?.[0].ac).not.toBe(99)
    } finally {
      await target.delete()
    }
  })

  it('rejects foreign JSON files', async () => {
    const dbi = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await expect(importBackup('{"foo": 1}', dbi)).rejects.toThrow('backup file')
      await expect(importBackup('not json', dbi)).rejects.toThrow('valid JSON')
    } finally {
      await dbi.delete()
    }
  })

  it('reminds only when homebrew exists and the export is stale', async () => {
    const dbi = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      // no homebrew → no reminder
      expect(await needsBackupReminder(dbi)).toBe(false)

      await saveHomebrewEntry('monsters', makeStatblock('Alpha'), dbi)
      // homebrew but never exported → remind
      expect(await needsBackupReminder(dbi)).toBe(true)

      const now = Date.now()
      await exportBackup(dbi, now)
      expect(await needsBackupReminder(dbi, now + DAY)).toBe(false)
      expect(await needsBackupReminder(dbi, now + 15 * DAY)).toBe(true)
    } finally {
      await dbi.delete()
    }
  })

  it('stays silent once the reminder is turned off, and returns when turned back on', async () => {
    const dbi = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await saveHomebrewEntry('monsters', makeStatblock('Alpha'), dbi)
      expect(await needsBackupReminder(dbi)).toBe(true)
      expect(await isBackupReminderOff(dbi)).toBe(false)

      await setBackupReminderOff(true, dbi)
      expect(await isBackupReminderOff(dbi)).toBe(true)
      expect(await needsBackupReminder(dbi)).toBe(false)

      await setBackupReminderOff(false, dbi)
      expect(await isBackupReminderOff(dbi)).toBe(false)
      expect(await needsBackupReminder(dbi)).toBe(true)
    } finally {
      await dbi.delete()
    }
  })

  it('keeps the opt-out out of the exported backup file', async () => {
    const dbi = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await saveHomebrewEntry('monsters', makeStatblock('Alpha'), dbi)
      await setBackupReminderOff(true, dbi)
      expect(JSON.parse(await exportBackup(dbi))).not.toHaveProperty('meta')
    } finally {
      await dbi.delete()
    }
  })
})
