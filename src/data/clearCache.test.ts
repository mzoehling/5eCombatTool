import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { clearSrdCache } from './clearCache'

describe('clearSrdCache', () => {
  it('clears the SRD tables and version marker but keeps user data', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await db.monsters.put({ id: 'srd-goblin', name: 'Goblin' } as never)
      await db.spells.put({ id: 'srd-fireball', name: 'Fireball' } as never)
      await db.items.put({ id: 'srd-dagger', name: 'Dagger' } as never)
      await db.rules.put({ id: 'xphb-speed', name: 'Speed', source: 'XPHB', page: 374, text: [] })
      await db.meta.put({ key: 'srdDataVersion', value: 'abc123' })
      await db.homebrew.put({ id: 'hb-1', kind: 'npc', statblock: { name: 'Bob' } } as never)
      await db.encounters.put({ id: 'enc-1', name: 'Ambush' } as never)

      await clearSrdCache(db)

      expect(await db.monsters.count()).toBe(0)
      expect(await db.spells.count()).toBe(0)
      expect(await db.items.count()).toBe(0)
      expect(await db.rules.count()).toBe(0)
      expect(await db.meta.get('srdDataVersion')).toBeUndefined()

      expect(await db.homebrew.count()).toBe(1)
      expect(await db.encounters.count()).toBe(1)
    } finally {
      await db.delete()
    }
  })
})
