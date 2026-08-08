import { describe, expect, it } from 'vitest'
import { amountWithFactor, readSave, saveBonus } from './saves'
import type { Combatant, Statblock } from '../types'

function combatant(statblock?: Partial<Statblock>): Combatant {
  return {
    statblock: statblock
      ? ({ abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, saves: {}, ...statblock } as Statblock)
      : undefined,
  } as Combatant
}

describe('saveBonus', () => {
  it('uses the statblock save when the creature is proficient', () => {
    expect(saveBonus(combatant({ saves: { dex: 7 } }), 'dex')).toBe(7)
  })

  it('falls back to the plain ability modifier', () => {
    expect(saveBonus(combatant({}), 'dex')).toBe(2)
  })

  it('treats a hand-added combatant with no statblock as +0', () => {
    expect(saveBonus(combatant(), 'dex')).toBe(0)
  })

  it('keeps a save of 0 rather than falling through to the modifier', () => {
    expect(saveBonus(combatant({ saves: { dex: 0 } }), 'dex')).toBe(0)
  })
})

describe('readSave', () => {
  it('succeeds when the total meets the DC', () => {
    expect(readSave(10, 5, 15)).toBe('saved')
  })

  it('fails below the DC', () => {
    expect(readSave(9, 5, 15)).toBe('failed')
  })
})

describe('amountWithFactor', () => {
  it('rounds down at every factor, as the rules do', () => {
    expect(amountWithFactor(17, 0.5)).toBe(8)
    expect(amountWithFactor(17, 0.25)).toBe(4)
    expect(amountWithFactor(17, 1)).toBe(17)
    expect(amountWithFactor(17, 2)).toBe(34)
  })

  it('gives an immune target nothing', () => {
    // ×0 is the whole point of offering the factor as a multiplier: immunity is
    // the same arithmetic as resistance, not a separate case.
    expect(amountWithFactor(17, 0)).toBe(0)
  })

  it('never goes below zero', () => {
    expect(amountWithFactor(0, 2)).toBe(0)
    expect(amountWithFactor(-4, 1)).toBe(0)
  })

  it('rounds a small amount away rather than down to a fraction', () => {
    // 1 damage against resistance is 0, not 0.5 — the reducer takes integers.
    expect(amountWithFactor(1, 0.5)).toBe(0)
    expect(Number.isInteger(amountWithFactor(7, 0.25))).toBe(true)
  })
})
