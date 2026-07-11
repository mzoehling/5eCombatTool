import { describe, expect, it } from 'vitest'
import { evalArithmetic } from './arithmetic'

describe('evalArithmetic', () => {
  it('evaluates plain numbers and +/- chains', () => {
    expect(evalArithmetic('13')).toBe(13)
    expect(evalArithmetic('10+3')).toBe(13)
    expect(evalArithmetic('25-7+2')).toBe(20)
    expect(evalArithmetic(' 10 + 3 ')).toBe(13)
    expect(evalArithmetic('-5')).toBe(-5)
  })

  it('rejects invalid input', () => {
    expect(evalArithmetic('')).toBeNull()
    expect(evalArithmetic('abc')).toBeNull()
    expect(evalArithmetic('10+')).toBeNull()
    expect(evalArithmetic('10*3')).toBeNull()
    expect(evalArithmetic('1d8+2')).toBeNull()
  })
})
