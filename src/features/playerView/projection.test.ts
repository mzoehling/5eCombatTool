import { describe, expect, it } from 'vitest'
import { initialState, type BattleState } from '../../store/battleReducer'
import type { Combatant } from '../../types'
import { healthStatus, parseSnapshotMessage, projectSnapshot, wrapSnapshot } from './projection'

function makeCombatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'x',
    name: 'X',
    hp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 15,
    initiative: 10,
    initiativeBonus: 2,
    sortIndex: 0,
    isActive: true,
    isPC: false,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [{ id: 'l1', name: 'Secret Ability', max: 1, used: 0 }],
    ...overrides,
  }
}

const dragonStatblockStub = { name: 'Adult Red Dragon' }

function stateWith(combatants: Combatant[], battle?: Partial<BattleState['battle']>): BattleState {
  return {
    ...initialState,
    combatants,
    battle: { ...initialState.battle, ...battle },
  }
}

describe('healthStatus', () => {
  it('maps HP ratios to coarse statuses at the documented boundaries', () => {
    expect(healthStatus(10, 10)).toBe('Unharmed')
    expect(healthStatus(9, 10)).toBe('Injured')
    expect(healthStatus(5, 10)).toBe('Bloodied')
    expect(healthStatus(2, 10)).toBe('Critical')
    expect(healthStatus(0, 10)).toBe('Down')
  })
})

describe('projectSnapshot', () => {
  it('gives PCs exact HP and non-PCs only a status word', () => {
    const snapshot = projectSnapshot(
      stateWith([
        makeCombatant({ id: 'pc', name: 'Thoric', isPC: true, hp: 17, maxHp: 45, tempHp: 3, initiative: 20 }),
        makeCombatant({ id: 'npc', name: 'Hooded Figure', hp: 4, maxHp: 10, initiative: 15 }),
      ]),
    )
    expect(snapshot.participants[0].health).toEqual({ kind: 'pc', hp: 17, maxHp: 45, tempHp: 3 })
    expect(snapshot.participants[1].health).toEqual({ kind: 'npc', status: 'Bloodied' })
  })

  it('omits hidden combatants entirely', () => {
    const snapshot = projectSnapshot(
      stateWith([
        makeCombatant({ id: 'a', name: 'Visible' }),
        makeCombatant({ id: 'b', name: 'Ambusher', hiddenFromPlayers: true }),
      ]),
    )
    expect(JSON.stringify(snapshot)).not.toContain('Ambusher')
  })

  it('omits inactive combatants and out-of-battle groups', () => {
    const snapshot = projectSnapshot(
      stateWith(
        [
          makeCombatant({ id: 'a', name: 'Fighter' }),
          makeCombatant({ id: 'b', name: 'Benched', isActive: false }),
          makeCombatant({ id: 'c', name: 'Reservist', groupId: 'g1' }),
        ],
        { groups: [{ id: 'g1', name: 'Reserve', inBattle: false }] },
      ),
    )
    expect(snapshot.participants.map((p) => p.name)).toEqual(['Fighter'])
  })

  it('transmits initiative order but never initiative values, AC, statblocks, limits, or notes', () => {
    const state = stateWith(
      [
        makeCombatant({
          id: 'a',
          name: 'First',
          initiative: 23,
          armorClass: 19,
          statblock: dragonStatblockStub as never,
          conditions: [{ condition: 'Prone', remainingRounds: 2, note: 'tripped by the barbarian' }],
        }),
        makeCombatant({ id: 'b', name: 'Second', initiative: 7, armorClass: 12 }),
      ],
      { isRunning: true, activeCombatantId: 'a', round: 3 },
    )
    const snapshot = projectSnapshot(state)
    expect(snapshot.participants.map((p) => p.name)).toEqual(['First', 'Second'])

    const json = JSON.stringify(snapshot)
    expect(json).not.toContain('23') // initiative value
    expect(json).not.toContain('19') // AC
    expect(json).not.toContain('armorClass')
    expect(json).not.toContain('initiative')
    expect(json).not.toContain('statblock')
    expect(json).not.toContain('Adult Red Dragon')
    expect(json).not.toContain('Secret Ability')
    expect(json).not.toContain('limits')
    expect(json).not.toContain('note')
    expect(json).not.toContain('tripped')

    // conditions with rounds ARE visible
    expect(snapshot.participants[0].conditions).toEqual([{ condition: 'Prone', remainingRounds: 2 }])
    expect(snapshot.round).toBe(3)
    expect(snapshot.activeId).toBe('a')
  })

  it('omits unset condition fields instead of sending undefined (binarypack turns undefined into null)', () => {
    const snapshot = projectSnapshot(
      stateWith([makeCombatant({ conditions: [{ condition: 'Frightened' }] })]),
    )
    const condition = snapshot.participants[0].conditions[0]
    expect(Object.keys(condition)).toEqual(['condition'])
  })

  it('shows the forming order without a turn marker before the battle runs', () => {
    const snapshot = projectSnapshot(
      stateWith([makeCombatant({ id: 'a' })], { isRunning: false, activeCombatantId: 'a' }),
    )
    expect(snapshot.isRunning).toBe(false)
    expect(snapshot.activeId).toBeNull()
    expect(snapshot.participants).toHaveLength(1)
  })

  it('stays player-safe after damage mutations (projection re-derives)', () => {
    const state = stateWith([makeCombatant({ id: 'npc', hp: 10, maxHp: 10 })])
    expect(projectSnapshot(state).participants[0].health).toEqual({ kind: 'npc', status: 'Unharmed' })
    const damaged = { ...state, combatants: [{ ...state.combatants[0], hp: 0 }] }
    expect(projectSnapshot(damaged).participants[0].health).toEqual({ kind: 'npc', status: 'Down' })
  })
})

describe('snapshot envelope', () => {
  it('round-trips through wrap/parse', () => {
    const snapshot = projectSnapshot(stateWith([makeCombatant({})]))
    const parsed = parseSnapshotMessage(JSON.parse(JSON.stringify(wrapSnapshot(snapshot))))
    expect(parsed).toEqual(snapshot)
  })

  it('rejects foreign messages', () => {
    expect(parseSnapshotMessage(null)).toBeNull()
    expect(parseSnapshotMessage({ v: 2, type: 'snapshot', payload: {} })).toBeNull()
    expect(parseSnapshotMessage({ v: 1, type: 'other', payload: {} })).toBeNull()
    expect(parseSnapshotMessage('snapshot')).toBeNull()
  })
})
