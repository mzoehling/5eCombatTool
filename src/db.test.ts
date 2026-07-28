import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { CombatDb } from './db'
import { HOMEBREW_PACK_ID, HOMEBREW_PACK_NAME, type Battle, type Combatant } from './types'

function makeDb() {
  return new CombatDb(`test-${crypto.randomUUID()}`)
}

const combatant: Combatant = {
  id: 'c1',
  name: 'Goblin A',
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
  conditions: [{ condition: 'Prone' }],
  limits: [{ id: 'l1', name: 'Nimble Escape', max: 1, used: 0 }],
}

describe('CombatDb', () => {
  let db: CombatDb

  afterEach(async () => {
    await db.delete()
  })

  it('round-trips a combatant', async () => {
    db = makeDb()
    await db.combatants.put(combatant)
    const loaded = await db.combatants.get('c1')
    expect(loaded).toEqual(combatant)
  })

  it('stores singleton battle state with groups', async () => {
    db = makeDb()
    const battle: Battle = {
      id: 'current',
      round: 3,
      activeCombatantId: 'c1',
      isRunning: true,
      groups: [{ id: 'g1', name: 'Reserve', inBattle: false }],
    }
    await db.battle.put(battle)
    expect(await db.battle.get('current')).toEqual(battle)
  })

  it('indexes combatants by sortIndex', async () => {
    db = makeDb()
    await db.combatants.bulkPut([
      { ...combatant, id: 'a', sortIndex: 2 },
      { ...combatant, id: 'b', sortIndex: 0 },
      { ...combatant, id: 'c', sortIndex: 1 },
    ])
    const ordered = await db.combatants.orderBy('sortIndex').toArray()
    expect(ordered.map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
})

/** Opens the pre-v4 schema, where homebrew was its own table. */
async function openV3(name: string): Promise<Dexie> {
  const legacy = new Dexie(name)
  legacy.version(1).stores({
    monsters: 'id, name, crNumeric',
    spells: 'id, name, level',
    items: 'id, name, rarity',
    packs: 'packId',
    homebrew: 'id, name, kind',
    combatants: 'id, sortIndex, groupId',
    battle: 'id',
    meta: 'key',
  })
  legacy.version(2).stores({ encounters: 'id, name' })
  legacy.version(3).stores({ rules: 'id, name' })
  await legacy.open()
  return legacy
}

const legacyEntry = (id: string, name: string, kind: 'monster' | 'pc') => ({
  id,
  kind,
  statblock: { id, name, source: 'HB', ac: 10, hp: { average: 10 } },
  createdAt: 1,
  updatedAt: 2,
})

describe('homebrew migration (v3 → v5)', () => {
  let db: CombatDb

  afterEach(async () => {
    await db.delete()
  })

  it('folds the homebrew table into the Homebrew pack, splitting by kind', async () => {
    const name = `test-${crypto.randomUUID()}`
    const legacy = await openV3(name)
    await legacy.table('homebrew').bulkPut([
      legacyEntry('hb-1', 'Custom Goblin', 'monster'),
      legacyEntry('hb-2', 'Thoric', 'pc'),
    ])
    legacy.close()

    db = new CombatDb(name)
    const pack = await db.packs.get(HOMEBREW_PACK_ID)
    expect(pack?.name).toBe(HOMEBREW_PACK_NAME)
    expect(pack?.monsters?.map((m) => m.name)).toEqual(['Custom Goblin'])
    expect(pack?.pcs?.map((p) => p.name)).toEqual(['Thoric'])
    // The table is gone, so nothing can keep writing to the old model.
    expect(db.tables.map((t) => t.name)).not.toContain('homebrew')
  })

  it('leaves a database with no homebrew alone', async () => {
    const name = `test-${crypto.randomUUID()}`
    const legacy = await openV3(name)
    legacy.close()

    db = new CombatDb(name)
    expect(await db.packs.get(HOMEBREW_PACK_ID)).toBeUndefined()
  })

  it('merges rather than overwriting an existing Homebrew pack', async () => {
    const name = `test-${crypto.randomUUID()}`
    const legacy = await openV3(name)
    await legacy.table('packs').put({
      packId: HOMEBREW_PACK_ID,
      name: HOMEBREW_PACK_NAME,
      version: '1',
      monsters: [{ id: 'hb-existing', name: 'Already Here' }],
    })
    await legacy.table('homebrew').put(legacyEntry('hb-1', 'Custom Goblin', 'monster'))
    legacy.close()

    db = new CombatDb(name)
    const names = (await db.packs.get(HOMEBREW_PACK_ID))?.monsters?.map((m) => m.name)
    expect(names?.sort()).toEqual(['Already Here', 'Custom Goblin'])
  })

  it('keeps imported packs untouched', async () => {
    const name = `test-${crypto.randomUUID()}`
    const legacy = await openV3(name)
    await legacy.table('packs').put({ packId: 'xmm-2024', name: 'MM', version: '1', monsters: [] })
    await legacy.table('homebrew').put(legacyEntry('hb-1', 'Custom Goblin', 'monster'))
    legacy.close()

    db = new CombatDb(name)
    expect((await db.packs.get('xmm-2024'))?.name).toBe('MM')
  })
})
