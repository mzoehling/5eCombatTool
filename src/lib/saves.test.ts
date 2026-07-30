import { describe, expect, it } from 'vitest'
import { amountAfterSave, readSave, saveBonus } from './saves'
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

describe('amountAfterSave', () => {
  it('halves a made save, rounding down', () => {
    expect(amountAfterSave(17, 'saved')).toBe(8)
  })

  it('leaves a failed save at full', () => {
    expect(amountAfterSave(17, 'failed')).toBe(17)
  })

  it('leaves an unjudged target at full', () => {
    expect(amountAfterSave(17, undefined)).toBe(17)
  })
})
