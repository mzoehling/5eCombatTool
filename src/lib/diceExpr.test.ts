import { describe, expect, it } from 'vitest'
import { formatBreakdown, parseDiceExpression, rollDiceExpression, rollWithMode } from './diceExpr'

/** Deterministic "roll": always the die's maximum. */
const maxRoll = (sides: number) => sides

describe('parseDiceExpression', () => {
  it('parses simple statblock notation', () => {
    expect(parseDiceExpression('1d8')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 8 }])
    expect(parseDiceExpression('2d6 + 3')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'flat', sign: 1, value: 3 },
    ])
    expect(parseDiceExpression('1d4 - 1')).toEqual([
      { kind: 'dice', sign: 1, count: 1, sides: 4 },
      { kind: 'flat', sign: -1, value: 1 },
    ])
  })

  it('parses a bare die without a count ("d10")', () => {
    expect(parseDiceExpression('d10')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 10 }])
  })

  it('accepts German "w" notation and mixed case', () => {
    expect(parseDiceExpression('1w8')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 8 }])
    expect(parseDiceExpression('3W8 + 5')).toEqual([
      { kind: 'dice', sign: 1, count: 3, sides: 8 },
      { kind: 'flat', sign: 1, value: 5 },
    ])
  })

  it('accepts input without spaces and multiple dice terms', () => {
    expect(parseDiceExpression('3w8+5+2w4')).toEqual([
      { kind: 'dice', sign: 1, count: 3, sides: 8 },
      { kind: 'flat', sign: 1, value: 5 },
      { kind: 'dice', sign: 1, count: 2, sides: 4 },
    ])
  })

  it('rejects invalid input', () => {
    expect(parseDiceExpression('')).toBeNull()
    expect(parseDiceExpression('abc')).toBeNull()
    expect(parseDiceExpression('2d')).toBeNull()
    expect(parseDiceExpression('2d6 3')).toBeNull() // missing operator
    expect(parseDiceExpression('2d6 +')).toBeNull()
    expect(parseDiceExpression('9999d6')).toBeNull() // absurd count
  })
})

describe('rollDiceExpression', () => {
  it('totals dice and modifiers with signs', () => {
    const result = rollDiceExpression('3w8+5+2w4', maxRoll)!
    expect(result.total).toBe(24 + 5 + 8)
    expect(result.terms.map((t) => t.subtotal)).toEqual([24, 5, 8])
    expect(result.terms[0].rolls).toEqual([8, 8, 8])
  })

  it('subtracts negative terms', () => {
    expect(rollDiceExpression('1d4 - 1', maxRoll)!.total).toBe(3)
    expect(rollDiceExpression('10 - 2d6', maxRoll)!.total).toBe(-2)
  })

  it('returns null for invalid input', () => {
    expect(rollDiceExpression('not dice', maxRoll)).toBeNull()
  })

  it('stays within die bounds with the real roller', () => {
    for (let i = 0; i < 50; i++) {
      const { total } = rollDiceExpression('2d6+1')!
      expect(total).toBeGreaterThanOrEqual(3)
      expect(total).toBeLessThanOrEqual(13)
    }
  })
})

describe('rollWithMode', () => {
  /** Deterministic sequence roller. */
  const sequence = (values: number[]) => {
    let i = 0
    return () => values[i++ % values.length]
  }

  it('normal mode rolls once', () => {
    const result = rollWithMode('1d20+5', 'normal', sequence([10]))!
    expect(result.kept.total).toBe(15)
    expect(result.discarded).toBeUndefined()
  })

  it('advantage keeps the higher of two full rolls', () => {
    const result = rollWithMode('1d20+5', 'advantage', sequence([8, 17]))!
    expect(result.kept.total).toBe(22)
    expect(result.discarded!.total).toBe(13)
  })

  it('disadvantage keeps the lower of two full rolls', () => {
    const result = rollWithMode('2d6', 'disadvantage', sequence([6, 6, 1, 2]))!
    expect(result.kept.total).toBe(3)
    expect(result.discarded!.total).toBe(12)
  })

  it('returns null for invalid input', () => {
    expect(rollWithMode('nope', 'advantage')).toBeNull()
  })
})

describe('formatBreakdown', () => {
  it('shows each term with its rolls', () => {
    const result = rollDiceExpression('3d8+5-1d4', maxRoll)!
    expect(formatBreakdown(result)).toBe('3d8 (8, 8, 8) + 5 − 1d4 (4)')
  })
})
