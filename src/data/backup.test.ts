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
  it('round-trips homebrew through export/import', async () => {
    const source = new CombatDb(`test-${crypto.randomUUID()}`)
    const target = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await source.homebrew.bulkPut([makeEntry('Alpha'), makeEntry('Beta')])
      const json = await exportBackup(source)

      expect(await importBackup(json, target)).toBe(2)
      expect(await target.homebrew.count()).toBe(2)
      expect((await target.homebrew.get('hb-alpha'))?.statblock.name).toBe('Alpha')
    } finally {
      await source.delete()
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
