import { describe, expect, it } from 'vitest'
import { sourceLabel } from './format'

describe('sourceLabel', () => {
  it('includes the page when known', () => {
    expect(sourceLabel('XPHB', 364)).toBe('XPHB p. 364')
  })

  it('omits the page when unknown', () => {
    expect(sourceLabel('HB', undefined)).toBe('HB')
  })
})
