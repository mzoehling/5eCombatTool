import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import type { Combatant, SavedEncounter } from '../types'
import { instantiateEncounter, prepareForAdd, saveEncounter } from './encounters'

function makeCombatant(id: string, name: string, patch: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name,
    hp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 13,
    initiative: 0,
    initiativeBonus: 1,
    sortIndex: 0,
    isActive: true,
    isPC: false,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [],
    ...patch,
  }
}

describe('saveEncounter', () => {
  it('creates entries and overwrites by name (case-insensitive)', async () => {
    const dbi = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      const first = await saveEncounter('Ambush', [makeCombatant('a', 'Goblin')], [], dbi, 1000)
      const second = await saveEncounter('  ambush ', [makeCombatant('a', 'Goblin'), makeCombatant('b', 'Wolf')], [], dbi, 2000)
      expect(second.id).toBe(first.id)
      expect(second.createdAt).toBe(1000)
      expect(second.updatedAt).toBe(2000)
      expect(await dbi.encounters.count()).toBe(1)
      expect((await dbi.encounters.get(first.id))?.combatants).toHaveLength(2)
    } finally {
      await dbi.delete()
    }
  })
})

describe('instantiateEncounter', () => {
  it('remaps combatant and group ids while keeping membership', () => {
    const saved: SavedEncounter = {
      id: 'e1',
      name: 'Ambush',
      createdAt: 0,
      updatedAt: 0,
      combatants: [makeCombatant('a', 'Goblin', { groupId: 'g1' }), makeCombatant('b', 'Wolf')],
      groups: [{ id: 'g1', name: 'Pack', inBattle: true }],
    }
    const first = instantiateEncounter(saved)
    const second = instantiateEncounter(saved)
    expect(first.combatants[0].id).not.toBe('a')
    expect(first.combatants[0].id).not.toBe(second.combatants[0].id)
    expect(first.groups[0].id).not.toBe('g1')
    expect(first.combatants[0].groupId).toBe(first.groups[0].id)
    expect(first.combatants[1].groupId).toBeUndefined()
  })
})

describe('prepareForAdd', () => {
  it('suffixes clashing NPC names and drops PCs already present', () => {
    const incoming = [
      makeCombatant('a', 'Goblin'),
      makeCombatant('b', 'Alva', { isPC: true }),
      makeCombatant('c', 'Borin', { isPC: true }),
    ]
    const { combatants, skippedPCs } = prepareForAdd(incoming, ['Goblin', 'Alva'])
    expect(skippedPCs).toBe(1)
    expect(combatants.map((c) => c.name)).toEqual(['Goblin A', 'Borin'])
  })

  it('keeps names untouched when nothing clashes', () => {
    const { combatants, skippedPCs } = prepareForAdd([makeCombatant('a', 'Owlbear')], ['Goblin'])
    expect(skippedPCs).toBe(0)
    expect(combatants[0].name).toBe('Owlbear')
  })
})
