import { describe, expect, it } from 'vitest'
import {
  formatCoins,
  formatWeight,
  itemPrice,
  itemPriceShort,
  itemPriceSortValue,
  itemStatsLine,
} from './itemPrice'

/** Only the fields pricing depends on. */
const item = (over: Partial<Parameters<typeof itemStatsLine>[0]> = {}) => ({
  valueCp: undefined,
  rarity: undefined,
  weight: undefined,
  typeName: 'Wondrous Item',
  ...over,
})

describe('itemPrice', () => {
  it('reports a printed price and a rarity estimate separately', () => {
    // Spell Scroll (Cantrip): 30 GP printed, 50 GP derived — they disagree, and
    // keeping both is the whole point of the split.
    expect(itemPrice(item({ valueCp: 3000, rarity: 'common', typeName: 'Scroll' }))).toEqual({
      listedCp: 3000,
      derivedCp: 5000,
    })
  })

  it('reports only the printed price for mundane gear', () => {
    expect(itemPrice(item({ valueCp: 2500 }))).toEqual({ listedCp: 2500 })
  })

  it('derives permanent-item prices from rarity', () => {
    const cp = (rarity: string) => itemPrice(item({ rarity }))?.derivedCp
    expect(cp('common')).toBe(100_00)
    expect(cp('uncommon')).toBe(400_00)
    expect(cp('rare')).toBe(4_000_00)
    expect(cp('very rare')).toBe(40_000_00)
    expect(cp('legendary')).toBe(200_000_00)
  })

  it('halves the price of potions and scrolls', () => {
    expect(itemPrice(item({ rarity: 'uncommon', typeName: 'Potion' }))?.derivedCp).toBe(200_00)
    expect(itemPrice(item({ rarity: 'rare', typeName: 'Scroll' }))?.derivedCp).toBe(2_000_00)
    // Same rarity, permanent item — full price.
    expect(itemPrice(item({ rarity: 'rare', typeName: 'Ring' }))?.derivedCp).toBe(4_000_00)
  })

  it('normalizes rarity casing and stray whitespace', () => {
    expect(itemPrice(item({ rarity: 'Very Rare' }))?.derivedCp).toBe(40_000_00)
    expect(itemPrice(item({ rarity: ' rare ' }))?.derivedCp).toBe(4_000_00)
  })

  it('treats legendary items and artifacts as priceless', () => {
    expect(itemPrice(item({ rarity: 'legendary' }))?.priceless).toBe(true)
    expect(itemPrice(item({ rarity: 'artifact' }))?.priceless).toBe(true)
  })

  it('still prices legendary consumables — a level 9 scroll is bought and sold', () => {
    const scroll = itemPrice(item({ rarity: 'legendary', typeName: 'Scroll' }))
    expect(scroll?.priceless).toBeUndefined()
    expect(scroll?.derivedCp).toBe(100_000_00)
    expect(itemPrice(item({ rarity: 'legendary', typeName: 'Potion' }))?.priceless).toBeUndefined()
  })

  it('never calls an item priceless when the source prints a number', () => {
    expect(itemPrice(item({ rarity: 'legendary', valueCp: 1234 }))?.priceless).toBeUndefined()
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

describe('itemPriceShort', () => {
  it('prefers the printed price, unmarked', () => {
    expect(itemPriceShort(item({ valueCp: 2500, rarity: 'common', typeName: 'Potion' }))).toBe('25 GP')
  })

  it('marks a rarity estimate', () => {
    expect(itemPriceShort(item({ rarity: 'uncommon' }))).toBe('≈ 400 GP')
  })

  it('says Priceless instead of a number for legendary items and artifacts', () => {
    expect(itemPriceShort(item({ rarity: 'legendary' }))).toBe('Priceless')
    expect(itemPriceShort(item({ rarity: 'artifact' }))).toBe('Priceless')
  })

  it('is undefined when the item has no price at all', () => {
    expect(itemPriceShort(item())).toBeUndefined()
  })
})

describe('itemPriceSortValue', () => {
  it('orders by the printed price when there is one', () => {
    expect(itemPriceSortValue(item({ valueCp: 3000, rarity: 'common', typeName: 'Scroll' }))).toBe(3000)
  })

  it('falls back to the rarity estimate', () => {
    expect(itemPriceSortValue(item({ rarity: 'rare' }))).toBe(4_000_00)
  })

  it('ranks priceless items at the top rather than dropping them to the bottom', () => {
    const legendary = itemPriceSortValue(item({ rarity: 'legendary' }))!
    const veryRare = itemPriceSortValue(item({ rarity: 'very rare' }))!
    const artifact = itemPriceSortValue(item({ rarity: 'artifact' }))!
    expect(veryRare).toBeLessThan(legendary)
    expect(legendary).toBeLessThan(artifact)
  })

  it('is undefined for an item with no price, so it can sort last', () => {
    expect(itemPriceSortValue(item())).toBeUndefined()
  })
})

describe('itemStatsLine', () => {
  it('shows both prices when they disagree', () => {
    expect(itemStatsLine(item({ valueCp: 3000, rarity: 'common', typeName: 'Scroll' }))).toBe(
      'Price: 30 GP · rarity estimate ≈ 50 GP',
    )
  })

  it('shows one price when both agree, rather than repeating it', () => {
    // Potion of Healing: 50 GP printed, and common-consumable derives the same.
    expect(itemStatsLine(item({ valueCp: 5000, rarity: 'common', typeName: 'Potion' }))).toBe('Price: 50 GP')
  })

  it('says so when the price is only an estimate', () => {
    expect(itemStatsLine(item({ rarity: 'uncommon' }))).toBe('Price: ≈ 400 GP (estimated from rarity)')
  })

  it('says Priceless rather than quoting the rarity table', () => {
    expect(itemStatsLine(item({ rarity: 'legendary' }))).toBe('Price: Priceless')
    expect(itemStatsLine(item({ rarity: 'artifact', weight: 6 }))).toBe('Price: Priceless · Weight: 6 lb.')
  })

  it('includes weight, and works with weight alone', () => {
    expect(itemStatsLine(item({ valueCp: 2500, weight: 1 }))).toBe('Price: 25 GP · Weight: 1 lb.')
    expect(itemStatsLine(item({ weight: 6 }))).toBe('Weight: 6 lb.')
  })

  it('is undefined when there is nothing to report', () => {
    expect(itemStatsLine(item())).toBeUndefined()
  })

  it('keeps fractional weights readable', () => {
    expect(formatWeight(0.5)).toBe('0.5 lb.')
  })
})
