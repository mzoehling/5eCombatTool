import { describe, expect, it } from 'vitest'
import type { Combatant } from '../types'
import {
  battleReducer,
  initialState,
  sortedCombatants,
  turnOrder,
  type BattleAction,
  type BattleState,
} from './battleReducer'

function makeCombatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'x',
    name: 'X',
    hp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 12,
    initiative: null,
    initiativeBonus: 0,
    sortIndex: 0,
    isActive: true,
    isPC: false,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [],
    ...overrides,
  }
}

function stateWith(combatants: Combatant[], battle = initialState.battle): BattleState {
  return { ...initialState, combatants, battle }
}

function dispatchAll(state: BattleState, ...actions: BattleAction[]): BattleState {
  return actions.reduce(battleReducer, state)
}

describe('sorting', () => {
  it('sorts by initiative desc, ties by sortIndex, unrolled last', () => {
    const s = [
      makeCombatant({ id: 'a', initiative: 12, sortIndex: 5 }),
      makeCombatant({ id: 'b', initiative: 20, sortIndex: 1 }),
      makeCombatant({ id: 'c', initiative: 12, sortIndex: 2 }),
      makeCombatant({ id: 'd', initiative: null }),
    ]
    expect(sortedCombatants(s).map((c) => c.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('reorders a tie via the reorder action', () => {
    const state = stateWith([
      makeCombatant({ id: 'a', initiative: 12, sortIndex: 0 }),
      makeCombatant({ id: 'b', initiative: 12, sortIndex: 1 }),
      makeCombatant({ id: 'c', initiative: 12, sortIndex: 2 }),
    ])
    const next = battleReducer(state, { type: 'reorder', id: 'c', beforeId: 'a' })
    expect(sortedCombatants(next.combatants).map((c) => c.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('damage and healing', () => {
  it('temp HP absorbs damage first', () => {
    const state = stateWith([makeCombatant({ id: 'a', hp: 10, tempHp: 5 })])
    const next = battleReducer(state, { type: 'applyDamage', ids: ['a'], amount: 8 })
    expect(next.combatants[0].tempHp).toBe(0)
    expect(next.combatants[0].hp).toBe(7)
  })

  it('damage never drops below 0, healing never exceeds max', () => {
    const state = stateWith([makeCombatant({ id: 'a', hp: 3, maxHp: 10 })])
    const dead = battleReducer(state, { type: 'applyDamage', ids: ['a'], amount: 99 })
    expect(dead.combatants[0].hp).toBe(0)
    const healed = battleReducer(state, { type: 'applyHealing', ids: ['a'], amount: 99 })
    expect(healed.combatants[0].hp).toBe(10)
  })

  it('applies AoE damage per target with individual temp HP', () => {
    const state = stateWith([
      makeCombatant({ id: 'a', hp: 20, tempHp: 10 }),
      makeCombatant({ id: 'b', hp: 20, tempHp: 0 }),
    ])
    const next = battleReducer(state, { type: 'applyDamage', ids: ['a', 'b'], amount: 12 })
    expect(next.combatants[0]).toMatchObject({ tempHp: 0, hp: 18 })
    expect(next.combatants[1]).toMatchObject({ tempHp: 0, hp: 8 })
  })
})

describe('initiative rolling', () => {
  it('adds the initiative bonus to rolled values', () => {
    const state = stateWith([makeCombatant({ id: 'a', initiativeBonus: 3 })])
    const next = battleReducer(state, { type: 'rollInitiative', ids: ['a'], rolls: [15] })
    expect(next.combatants[0].initiative).toBe(18)
  })
})

describe('battle flow', () => {
  const three = [
    makeCombatant({ id: 'a', initiative: 20, sortIndex: 0 }),
    makeCombatant({ id: 'b', initiative: 15, sortIndex: 1 }),
    makeCombatant({ id: 'c', initiative: 10, sortIndex: 2 }),
  ]

  it('start → next → wraps with round increment; back decrements', () => {
    let state = dispatchAll(stateWith(three), { type: 'startBattle' })
    expect(state.battle.activeCombatantId).toBe('a')
    expect(state.battle.round).toBe(1)

    state = dispatchAll(state, { type: 'nextTurn' }, { type: 'nextTurn' }, { type: 'nextTurn' })
    expect(state.battle.activeCombatantId).toBe('a')
    expect(state.battle.round).toBe(2)

    state = battleReducer(state, { type: 'prevTurn' })
    expect(state.battle.activeCombatantId).toBe('c')
    expect(state.battle.round).toBe(1)
  })

  it('skips combatants whose group is out of battle', () => {
    const grouped = [
      makeCombatant({ id: 'a', initiative: 20, sortIndex: 0 }),
      makeCombatant({ id: 'b', initiative: 15, sortIndex: 1, groupId: 'reserve' }),
      makeCombatant({ id: 'c', initiative: 10, sortIndex: 2 }),
    ]
    let state = stateWith(grouped)
    state = dispatchAll(
      state,
      { type: 'addGroup', group: { id: 'reserve', name: 'Reserve', inBattle: false } },
      { type: 'startBattle' },
      { type: 'nextTurn' },
    )
    expect(state.battle.activeCombatantId).toBe('c')

    state = battleReducer(state, { type: 'setGroupInBattle', id: 'reserve', inBattle: true })
    expect(turnOrder(state).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('updates group fields via updateGroup', () => {
    let state = dispatchAll(stateWith([]), {
      type: 'addGroup',
      group: { id: 'g1', name: 'Goblins', inBattle: true },
    })
    state = battleReducer(state, { type: 'updateGroup', id: 'g1', patch: { color: '#ff0000', name: 'Gobbos' } })
    expect(state.battle.groups[0]).toEqual({ id: 'g1', name: 'Gobbos', inBattle: true, color: '#ff0000' })
  })

  it('decrements condition durations at the creature turn start and reports expiry', () => {
    const conditioned = [
      makeCombatant({
        id: 'a',
        initiative: 20,
        conditions: [
          { condition: 'Prone', remainingRounds: 1 },
          { condition: 'Frightened', remainingRounds: 3 },
          { condition: 'Charmed' },
        ],
      }),
      makeCombatant({ id: 'b', initiative: 15 }),
    ]
    // battle starts: a's turn begins → Prone (1 round) expires, Frightened ticks to 2
    let state = dispatchAll(stateWith(conditioned), { type: 'startBattle' })
    const a = state.combatants.find((c) => c.id === 'a')!
    expect(a.conditions.map((c) => `${c.condition}:${c.remainingRounds ?? '∞'}`)).toEqual([
      'Frightened:2',
      'Charmed:∞',
    ])
    expect(state.expiredConditions).toEqual([{ combatantName: 'X', condition: 'Prone' }])

    // b's turn: nothing to tick, notice cleared
    state = battleReducer(state, { type: 'nextTurn' })
    expect(state.expiredConditions).toEqual([])
  })
})

describe('limited use', () => {
  it('consumes and restores within bounds', () => {
    const state = stateWith([
      makeCombatant({ id: 'a', limits: [{ id: 'l1', name: 'Breath', max: 1, used: 0 }] }),
    ])
    let next = battleReducer(state, { type: 'consumeLimit', id: 'a', limitId: 'l1', delta: 1 })
    expect(next.combatants[0].limits[0].used).toBe(1)
    next = battleReducer(next, { type: 'consumeLimit', id: 'a', limitId: 'l1', delta: 1 })
    expect(next.combatants[0].limits[0].used).toBe(1)
    next = battleReducer(next, { type: 'consumeLimit', id: 'a', limitId: 'l1', delta: -1 })
    expect(next.combatants[0].limits[0].used).toBe(0)
  })
})

describe('turn-start automation', () => {
  const dragon = () =>
    makeCombatant({
      id: 'd',
      name: 'Dragon',
      initiative: 20,
      limits: [
        { id: 'l1', name: 'Fire Breath', max: 1, used: 1, rechargeRule: 'recharge:5' },
        { id: 'l2', name: 'Legendary Actions', max: 3, used: 2, rechargeRule: 'turn' },
        { id: 'l3', name: 'Fireball (1/Day)', max: 1, used: 1, rechargeRule: 'day' },
      ],
    })

  it('recharges abilities and resets legendary actions at the creature turn start', () => {
    const state = dispatchAll(
      stateWith([dragon(), makeCombatant({ id: 'b', initiative: 10 })]),
      { type: 'startBattle', dice: [6] }, // dragon first, recharge succeeds
    )
    const d = state.combatants.find((c) => c.id === 'd')!
    expect(d.limits.find((l) => l.id === 'l1')!.used).toBe(0)
    expect(d.limits.find((l) => l.id === 'l2')!.used).toBe(0)
    // daily uses never come back mid-battle
    expect(d.limits.find((l) => l.id === 'l3')!.used).toBe(1)
    expect(state.turnEvents).toEqual([
      'Dragon: Fire Breath recharged (rolled 6)',
      'Dragon: Legendary Actions reset (3/3)',
    ])
  })

  it('keeps a failed recharge spent and reports the roll', () => {
    const state = dispatchAll(
      stateWith([dragon(), makeCombatant({ id: 'b', initiative: 10 })]),
      { type: 'startBattle', dice: [2] },
    )
    expect(state.combatants.find((c) => c.id === 'd')!.limits[0].used).toBe(1)
    expect(state.turnEvents).toContain('Dragon: Fire Breath did not recharge (rolled 2)')
  })

  it('only processes the creature whose turn starts', () => {
    const state = dispatchAll(
      stateWith([makeCombatant({ id: 'b', initiative: 30 }), dragon()]),
      { type: 'startBattle', dice: [6] }, // b first — dragon untouched
    )
    expect(state.combatants.find((c) => c.id === 'd')!.limits[0].used).toBe(1)
    expect(state.turnEvents).toEqual([])
  })
})

describe('concentration notice', () => {
  it('emits a save DC when a concentrating creature takes damage', () => {
    const state = dispatchAll(
      stateWith([makeCombatant({ id: 'a', name: 'Mage', hp: 30, maxHp: 30 })]),
      { type: 'setCondition', id: 'a', condition: { condition: 'Concentration' } },
      { type: 'applyDamage', ids: ['a'], amount: 26 },
    )
    expect(state.turnEvents).toEqual(['Mage is concentrating — DC 13 Constitution save'])
    // minimum DC 10 for small hits
    const small = battleReducer(state, { type: 'applyDamage', ids: ['a'], amount: 3 })
    expect(small.turnEvents).toEqual(['Mage is concentrating — DC 10 Constitution save'])
  })

  it('stays silent for non-concentrating targets', () => {
    const state = dispatchAll(stateWith([makeCombatant({ id: 'a' })]), {
      type: 'applyDamage',
      ids: ['a'],
      amount: 5,
    })
    expect(state.turnEvents).toEqual([])
  })
})

describe('loadEncounter', () => {
  const saved = () => [
    makeCombatant({ id: 'n1', name: 'Goblin', groupId: 'g1' }),
    makeCombatant({ id: 'n2', name: 'Wolf' }),
  ]
  const groups = [{ id: 'g1', name: 'Pack', inBattle: true }]

  it('replace mode swaps combatants and groups and stops the battle', () => {
    let state = stateWith(
      [makeCombatant({ id: 'old', initiative: 15 })],
      { ...initialState.battle, isRunning: true, round: 4, activeCombatantId: 'old', groups: [{ id: 'x', name: 'Old', inBattle: true }] },
    )
    state = battleReducer(state, { type: 'loadEncounter', name: 'Ambush', combatants: saved(), groups, mode: 'replace' })
    expect(state.combatants.map((c) => c.id)).toEqual(['n1', 'n2'])
    expect(state.battle.groups).toEqual(groups)
    expect(state.battle.isRunning).toBe(false)
    expect(state.battle.round).toBe(1)
    expect(state.battle.activeCombatantId).toBeNull()
  })

  it('add mode appends combatants after the existing sort order and merges groups', () => {
    let state = stateWith([makeCombatant({ id: 'old', sortIndex: 7 })])
    state = battleReducer(state, { type: 'loadEncounter', name: 'Party', combatants: saved(), groups, mode: 'add' })
    expect(state.combatants).toHaveLength(3)
    const added = state.combatants.filter((c) => c.id !== 'old')
    expect(added.every((c) => c.sortIndex > 7)).toBe(true)
    expect(state.battle.groups).toEqual(groups)
  })
})
