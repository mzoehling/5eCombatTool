import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { CombatDb } from './db'
import type { Battle, Combatant } from './types'

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
