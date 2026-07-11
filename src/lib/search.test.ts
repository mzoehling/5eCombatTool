import { describe, expect, it } from 'vitest'
import { rankByName, searchScore, stripPostfix, suffixedNames } from './search'

describe('stripPostfix', () => {
  it('strips letter and number postfixes', () => {
    expect(stripPostfix('Goblin A')).toBe('Goblin')
    expect(stripPostfix('Wolf 12')).toBe('Wolf')
    expect(stripPostfix('Adult Red Dragon')).toBe('Adult Red Dragon')
    expect(stripPostfix('Goblin')).toBe('Goblin')
  })
})

describe('searchScore / rankByName', () => {
  const names = ['Goblin', 'Goblin Boss', 'Hobgoblin', 'Bugbear', 'Adult Red Dragon']

  it('ranks prefix over substring over subsequence', () => {
    const ranked = rankByName(names, 'gob', (n) => n)
    expect(ranked[0]).toBe('Goblin')
    expect(ranked[1]).toBe('Goblin Boss')
    expect(ranked[2]).toBe('Hobgoblin')
  })

  it('matches word prefixes strongly', () => {
    expect(searchScore('Adult Red Dragon', 'red')).toBeGreaterThan(searchScore('Bored Guard', 'red'))
  })

  it('supports subsequence matches', () => {
    expect(searchScore('Adult Red Dragon', 'ardr')).toBe(30)
    expect(searchScore('Goblin', 'xyz')).toBe(-1)
  })

  it('returns alphabetical order for empty query', () => {
    expect(rankByName(names, '', (n) => n)[0]).toBe('Adult Red Dragon')
  })
})

describe('suffixedNames', () => {
  it('keeps the plain name for a single copy without clashes', () => {
    expect(suffixedNames('Goblin', 1, [])).toEqual(['Goblin'])
  })

  it('suffixes multiple copies A, B, C', () => {
    expect(suffixedNames('Goblin', 3, [])).toEqual(['Goblin A', 'Goblin B', 'Goblin C'])
  })

  it('continues after existing copies', () => {
    expect(suffixedNames('Goblin', 2, ['Goblin A', 'Goblin B'])).toEqual(['Goblin C', 'Goblin D'])
  })

  it('suffixes a single copy when the plain name exists', () => {
    expect(suffixedNames('Goblin', 1, ['Goblin'])).toEqual(['Goblin A'])
  })
})
