import { describe, expect, it } from 'vitest'
import { provenanceLabel, sourceLabel } from './format'

describe('sourceLabel', () => {
  it('includes the page when known', () => {
    expect(sourceLabel('XPHB', 364)).toBe('XPHB p. 364')
  })

  it('omits the page when unknown', () => {
    expect(sourceLabel('HB', undefined)).toBe('HB')
  })
})

describe('provenanceLabel', () => {
  it('puts the provenance before the book citation', () => {
    expect(provenanceLabel('SRD 5.2.1', 'XPHB', 364)).toBe('SRD 5.2.1 · XPHB p. 364')
    expect(provenanceLabel("Xanathar's Guide", 'XGE', 12)).toBe("Xanathar's Guide · XGE p. 12")
  })

  it('drops the citation when it adds nothing', () => {
    expect(provenanceLabel('Homebrew', 'HB')).toBe('Homebrew')
    expect(provenanceLabel('Player character', '')).toBe('Player character')
  })
})
