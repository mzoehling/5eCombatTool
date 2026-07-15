import { describe, expect, it } from 'vitest'
import { filterSrd } from './env.ts'

describe('filterSrd', () => {
  it('keeps only srd52-flagged entries', () => {
    const entries = [{ name: 'A', srd52: true }, { name: 'B' }, { name: 'C', srd52: false }]
    expect(filterSrd(entries).map((e) => e.name)).toEqual(['A'])
  })

  it('renames entries whose srd52 flag is a string', () => {
    const entries = [{ name: 'Original', srd52: 'SRD Name' }]
    expect(filterSrd(entries).map((e) => e.name)).toEqual(['SRD Name'])
  })

  it('force-includes entries by name regardless of a missing/falsy flag', () => {
    const entries = [{ name: 'Influence' }, { name: 'Study', srd52: false }, { name: 'Attack', srd52: true }]
    const kept = filterSrd(entries, new Set(['Influence', 'Study'])).map((e) => e.name)
    expect(kept).toEqual(['Influence', 'Study', 'Attack'])
  })
})
