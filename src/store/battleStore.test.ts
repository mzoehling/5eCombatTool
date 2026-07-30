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

  it('takes one undo and one log line for a batched gesture', () => {
    // The shape that was broken: an AoE against a save sends full damage and
    // half damage as separate actions, so one Ctrl+Z used to leave the
    // full-damage targets hurt.
    battleStore.dispatch({ type: 'addCombatant', combatant: makeCombatant('b1', 'Failed Save') })
    battleStore.dispatch({ type: 'addCombatant', combatant: makeCombatant('b2', 'Made Save') })
    const before = battleStore.getLog().length

    battleStore.dispatchAll([
      { type: 'applyDamage', ids: ['b1'], amount: 12 },
      { type: 'applyDamage', ids: ['b2'], amount: 6 },
    ])
    const hp = (id: string) => battleStore.getState().combatants.find((c) => c.id === id)?.hp
    expect([hp('b1'), hp('b2')]).toEqual([8, 14])
    expect(battleStore.getLog().length - before).toBe(1)

    battleStore.undo()
    expect([hp('b1'), hp('b2')]).toEqual([20, 20])

    battleStore.dispatch({ type: 'removeCombatants', ids: ['b1', 'b2'] })
  })

  it('does nothing at all for an empty batch', () => {
    // Callers build the batch conditionally — an AoE with no targets in one of
    // its two groups sends only the other — so an empty list is reachable and
    // must not cost an undo step.
    const depth = battleStore.undoDepth()
    const logged = battleStore.getLog().length
    battleStore.dispatchAll([])
    expect(battleStore.undoDepth()).toBe(depth)
    expect(battleStore.getLog().length).toBe(logged)
  })

})
