import { describe, expect, it } from 'vitest'
import { conditionInstance, conditionSpread, customConditions } from './conditions'
import type { Combatant, ConditionInstance } from '../types'

function makeCombatant(name: string, conditions: ConditionInstance[] = []): Combatant {
  return {
    id: name,
    name,
    hp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 12,
    initiative: 10,
    initiativeBonus: 0,
    sortIndex: 0,
    isActive: true,
    isPC: false,
    hiddenFromPlayers: false,
    conditions,
    limits: [],
  }
}

describe('conditionSpread', () => {
  it('reads as on/off for a single target', () => {
    const on = [makeCombatant('a', [{ condition: 'Prone' }])]
    expect(conditionSpread(on, 'Prone')).toEqual({ on: 1, total: 1, all: true, none: false })
    expect(conditionSpread(on, 'Blinded')).toEqual({ on: 0, total: 1, all: false, none: true })
  })

  it('counts partial agreement across several targets', () => {
    // An area effect catches some who already had it, so the answer is not binary.
    const targets = [
      makeCombatant('a', [{ condition: 'Prone' }]),
      makeCombatant('b'),
      makeCombatant('c', [{ condition: 'Prone' }]),
    ]
    expect(conditionSpread(targets, 'Prone')).toEqual({ on: 2, total: 3, all: false, none: false })
  })

  it('reports agreement when every target has it', () => {
    const targets = [makeCombatant('a', [{ condition: 'Prone' }]), makeCombatant('b', [{ condition: 'Prone' }])]
    expect(conditionSpread(targets, 'Prone').all).toBe(true)
  })

  it('is not "all" for an empty selection', () => {
    expect(conditionSpread([], 'Prone')).toEqual({ on: 0, total: 0, all: false, none: true })
  })
})

describe('customConditions', () => {
  it('finds effects that are neither official nor a spell effect', () => {
    const targets = [
      makeCombatant('a', [{ condition: 'Prone' }, { condition: 'Marked by Ranger' }]),
      makeCombatant('b', [{ condition: 'Hexed by Warlock' }]),
    ]
    expect(customConditions(targets)).toEqual(['Hexed by Warlock', 'Marked by Ranger'])
  })

  it('lists a shared custom effect once', () => {
    const targets = [makeCombatant('a', [{ condition: 'Cursed' }]), makeCombatant('b', [{ condition: 'Cursed' }])]
    expect(customConditions(targets)).toEqual(['Cursed'])
  })

  it('leaves out the official conditions', () => {
    expect(customConditions([makeCombatant('a', [{ condition: 'Prone' }])])).toEqual([])
  })
})

describe('conditionInstance', () => {
  it('treats a blank duration as "until removed" rather than zero rounds', () => {
    // Zero rounds would expire the condition the instant it was applied.
    expect(conditionInstance('Prone', '')).toEqual({ condition: 'Prone' })
    expect(conditionInstance('Prone', 'abc')).toEqual({ condition: 'Prone' })
    expect(conditionInstance('Prone', '0')).toEqual({ condition: 'Prone' })
  })

  it('carries a positive duration', () => {
    expect(conditionInstance('Restrained', '3')).toEqual({ condition: 'Restrained', remainingRounds: 3 })
  })

  it('gives Exhaustion a level instead, clamped to 1–6', () => {
    expect(conditionInstance('Exhaustion', '', '4')).toEqual({ condition: 'Exhaustion', level: 4 })
    expect(conditionInstance('Exhaustion', '', '9')).toEqual({ condition: 'Exhaustion', level: 6 })
    expect(conditionInstance('Exhaustion', '', '0')).toEqual({ condition: 'Exhaustion', level: 1 })
    expect(conditionInstance('Exhaustion', '', 'x')).toEqual({ condition: 'Exhaustion', level: 1 })
  })

  it('gives a level only to Exhaustion', () => {
    expect(conditionInstance('Prone', '', '4')).toEqual({ condition: 'Prone' })
  })

  it('can carry both a duration and a level', () => {
    expect(conditionInstance('Exhaustion', '2', '3')).toEqual({
      condition: 'Exhaustion',
      remainingRounds: 2,
      level: 3,
    })
  })
})
