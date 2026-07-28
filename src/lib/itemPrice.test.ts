import { describe, expect, it } from 'vitest'
import { formatCoins, itemPrice, itemPriceLabel } from './itemPrice'

/** Only the three fields the price depends on. */
const item = (over: Partial<Parameters<typeof itemPrice>[0]> = {}) => ({
  valueCp: undefined,
  rarity: undefined,
  typeName: 'Wondrous Item',
  ...over,
})

describe('itemPrice', () => {
  it('prefers the price printed in the source over the rarity table', () => {
    // Potion of Healing: the derived value happens to agree (common consumable).
    expect(itemPrice(item({ valueCp: 5000, rarity: 'common', typeName: 'Potion' }))).toEqual({
      cp: 5000,
      estimated: false,
    })
    // Spell Scroll (Cantrip): 30 GP printed, where the rarity would derive 50.
    expect(itemPrice(item({ valueCp: 3000, rarity: 'common', typeName: 'Scroll' }))).toEqual({
      cp: 3000,
      estimated: false,
    })
  })

  it('derives permanent-item prices from rarity', () => {
    const gp = (rarity: string) => itemPrice(item({ rarity }))?.cp
    expect(gp('common')).toBe(100_00)
    expect(gp('uncommon')).toBe(400_00)
    expect(gp('rare')).toBe(4_000_00)
    expect(gp('very rare')).toBe(40_000_00)
    expect(gp('legendary')).toBe(200_000_00)
  })

  it('marks derived prices as estimates', () => {
    expect(itemPrice(item({ rarity: 'rare' }))?.estimated).toBe(true)
  })

  it('halves the price of potions and scrolls', () => {
    expect(itemPrice(item({ rarity: 'uncommon', typeName: 'Potion' }))?.cp).toBe(200_00)
    expect(itemPrice(item({ rarity: 'rare', typeName: 'Scroll' }))?.cp).toBe(2_000_00)
    // Same rarity, permanent item — full price.
    expect(itemPrice(item({ rarity: 'rare', typeName: 'Ring' }))?.cp).toBe(4_000_00)
  })

  it('normalizes rarity casing and stray whitespace', () => {
    expect(itemPrice(item({ rarity: 'Very Rare' }))?.cp).toBe(40_000_00)
    expect(itemPrice(item({ rarity: ' rare ' }))?.cp).toBe(4_000_00)
  })

  it('has no price for artifacts', () => {
    expect(itemPrice(item({ rarity: 'artifact' }))).toBeUndefined()
  })

  it('has no price for an unpriced item with no usable rarity', () => {
    expect(itemPrice(item())).toBeUndefined()
    expect(itemPrice(item({ rarity: '' }))).toBeUndefined()
    // "mundane" is the compendium filter's synthetic label, not a real rarity.
    expect(itemPrice(item({ rarity: 'mundane' }))).toBeUndefined()
  })
})

describe('formatCoins', () => {
  it('uses the largest denomination that divides evenly', () => {
    expect(formatCoins(1500)).toBe('15 GP')
    expect(formatCoins(200)).toBe('2 GP')
    expect(formatCoins(250)).toBe('25 SP')
    expect(formatCoins(40)).toBe('4 SP')
    expect(formatCoins(5)).toBe('5 CP')
    expect(formatCoins(1)).toBe('1 CP')
  })

  it('keeps sub-copper prices as decimals', () => {
    // A Sling Bullet is 4 for 1 CP.
    expect(formatCoins(0.2)).toBe('0.2 CP')
  })

  it('groups thousands', () => {
    expect(formatCoins(150_000)).toBe('1,500 GP')
    expect(formatCoins(3_000_000)).toBe('30,000 GP')
    expect(formatCoins(20_000_000)).toBe('200,000 GP')
  })
})

describe('itemPriceLabel', () => {
  it('formats the price and reports whether it was derived', () => {
    expect(itemPriceLabel(item({ valueCp: 2500 }))).toEqual({ text: '25 GP', estimated: false })
    expect(itemPriceLabel(item({ rarity: 'uncommon' }))).toEqual({ text: '400 GP', estimated: true })
  })

  it('is undefined when the item has no price', () => {
    expect(itemPriceLabel(item({ rarity: 'artifact' }))).toBeUndefined()
  })
})
