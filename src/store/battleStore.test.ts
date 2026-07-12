import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Combatant } from '../types'
import { battleStore } from './battleStore'

function makeCombatant(id: string, name: string): Combatant {
  return {
    id,
    name,
    hp: 20,
    maxHp: 20,
    tempHp: 0,
    armorClass: 14,
    initiative: 10,
    initiativeBonus: 2,
    sortIndex: 0,
    isActive: true,
    isPC: false,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [],
  }
}

describe('battleStore undo & log', () => {
  it('undoes the last change and records everything in the log', () => {
    battleStore.dispatch({ type: 'addCombatant', combatant: makeCombatant('u1', 'Undo Goblin') })
    battleStore.dispatch({ type: 'applyDamage', ids: ['u1'], amount: 12 })
    expect(battleStore.getState().combatants.find((c) => c.id === 'u1')?.hp).toBe(8)

    battleStore.undo()
    expect(battleStore.getState().combatants.find((c) => c.id === 'u1')?.hp).toBe(20)

    const messages = battleStore.getLog().map((e) => e.message)
    expect(messages).toContain('Undo Goblin added')
    expect(messages).toContain('12 damage → Undo Goblin')
    expect(messages).toContain('Undid the last change')

    // clean up shared singleton state for other suites
    battleStore.dispatch({ type: 'removeCombatants', ids: ['u1'] })
  })

  it('does nothing when there is nothing to undo', () => {
    while (battleStore.undoDepth() > 0) battleStore.undo()
    const state = battleStore.getState()
    battleStore.undo()
    expect(battleStore.getState()).toBe(state)
  })
})
