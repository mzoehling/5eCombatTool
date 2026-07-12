import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { emptyForm, formToStatblock } from '../lib/homebrewForm'
import type { HomebrewEntry } from '../types'
import { exportBackup, importBackup, needsBackupReminder } from './backup'

const DAY = 24 * 60 * 60 * 1000

function makeEntry(name: string): HomebrewEntry {
  const id = `hb-${name.toLowerCase()}`
  return {
    id,
    kind: 'monster',
    statblock: formToStatblock({ ...emptyForm, name }, id),
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('backup', () => {
  it('round-trips homebrew, packs and the battle through export/import', async () => {
    const source = new CombatDb(`test-${crypto.randomUUID()}`)
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await source.homebrew.bulkPut([makeEntry('Alpha'), makeEntry('Beta')])
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
      expect(await target.homebrew.count()).toBe(2)
      expect((await target.homebrew.get('hb-alpha'))?.statblock.name).toBe('Alpha')
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
      expect(await target.homebrew.count()).toBe(1)
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

      await dbi.homebrew.put(makeEntry('Alpha'))
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
})
