import { describe, expect, it } from 'vitest'
import { composeExpression } from './DiceRoller'
import { parseDiceExpression } from '../lib/diceExpr'

describe('composeExpression', () => {
  it('does not double the plus on a positive bonus', () => {
    expect(composeExpression({ 8: 1 }, 5)).toBe('1d8+5')
    expect(parseDiceExpression(composeExpression({ 8: 1 }, 5))).not.toBeNull()
  })

  it('keeps a negative bonus as a single minus', () => {
    expect(composeExpression({ 6: 2 }, -1)).toBe('2d6-1')
  })

  it('omits a zero bonus and joins several dice', () => {
    expect(composeExpression({ 6: 2, 8: 1 }, 0)).toBe('2d6+1d8')
  })

  it('is just the bonus with no dice', () => {
    expect(composeExpression({}, 4)).toBe('4')
    expect(composeExpression({}, 0)).toBe('')
  })
})
