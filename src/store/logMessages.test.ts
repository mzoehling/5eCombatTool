import { describe, expect, it } from 'vitest'
import type { Combatant } from '../types'
import { battleReducer, initialState, type BattleAction, type BattleState } from './battleReducer'
import { describeAction } from './logMessages'

function makeCombatant(id: string, name: string, patch: Partial<Combatant> = {}): Combatant {
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
    ...patch,
  }
}

function stateWith(...combatants: Combatant[]): BattleState {
  return combatants.reduce(
    (state, combatant) => battleReducer(state, { type: 'addCombatant', combatant }),
    initialState,
  )
}

function messagesFor(state: BattleState, action: BattleAction): string[] {
  return describeAction(action, state, battleReducer(state, action))
}

describe('describeAction', () => {
  const goblin = makeCombatant('g1', 'Goblin')
  const wolf = makeCombatant('w1', 'Wolf', { initiative: 5, sortIndex: 1 })

  it('describes damage and healing with target names', () => {
    const state = stateWith(goblin, wolf)
    expect(messagesFor(state, { type: 'applyDamage', ids: ['g1', 'w1'], amount: 7 })).toEqual([
      '7 damage → Goblin, Wolf',
    ])
    expect(messagesFor(state, { type: 'applyHealing', ids: ['g1'], amount: 4 })).toEqual(['4 healing → Goblin'])
  })

  it('describes turn changes with round transitions and expiring conditions', () => {
    let state = stateWith(goblin, wolf)
    state = battleReducer(state, {
      type: 'setCondition',
      id: 'w1',
      condition: { condition: 'Prone', remainingRounds: 1 },
    })
    state = battleReducer(state, { type: 'startBattle' })
    // Goblin active; advancing reaches Wolf, whose Prone expires
    expect(messagesFor(state, { type: 'nextTurn' })).toEqual(["Wolf's turn", 'Prone expired on Wolf'])
  })

  it('describes rolled initiative with the resulting values', () => {
    const state = stateWith(makeCombatant('g1', 'Goblin', { initiative: 0, initiativeBonus: 2 }))
    const messages = describeAction(
      { type: 'rollInitiative', ids: ['g1'], rolls: [10] },
      state,
      battleReducer(state, { type: 'rollInitiative', ids: ['g1'], rolls: [10] }),
    )
    expect(messages).toEqual(['Initiative rolled: Goblin 12'])
  })

  it('describes conditions and limited uses', () => {
    const withLimit = makeCombatant('g1', 'Goblin', {
      limits: [{ id: 'l1', name: 'Fire Breath', max: 1, used: 0, rechargeRule: 'recharge:5' }],
    })
    const state = stateWith(withLimit)
    expect(
      messagesFor(state, { type: 'setCondition', id: 'g1', condition: { condition: 'Prone', remainingRounds: 2 } }),
    ).toEqual(['Goblin: Prone (2 rounds)'])
    expect(messagesFor(state, { type: 'removeCondition', id: 'g1', condition: 'Prone' })).toEqual([
      'Goblin: Prone removed',
    ])
    expect(messagesFor(state, { type: 'consumeLimit', id: 'g1', limitId: 'l1', delta: 1 })).toEqual([
      'Goblin: Fire Breath used (0/1 left)',
    ])
  })

  it('stays silent for actions not worth logging', () => {
    const state = stateWith(goblin)
    expect(messagesFor(state, { type: 'assignGroup', combatantId: 'g1', groupId: undefined })).toEqual([])
    expect(messagesFor(state, { type: 'updateCombatant', id: 'g1', patch: { name: 'Boblin' } })).toEqual([])
  })
})
