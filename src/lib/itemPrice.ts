import type { Item } from '../types'

/**
 * Magic-item prices by rarity, in gold pieces, for non-consumables (2024 rules).
 * "artifact" is deliberately absent — artifacts carry no listed price.
 */
const RARITY_GP: Record<string, number> = {
  common: 100,
  uncommon: 400,
  rare: 4_000,
  'very rare': 40_000,
  legendary: 200_000,
}

/**
 * Consumables cost half. Neither the parsed data nor the upstream source carries
 * a "consumable" flag, so the item type stands in for it: potions are drunk and
 * scrolls are burned. This misses consumable Wondrous Items (Dust of
 * Disappearance and friends), which fall back to the permanent-item price — one
 * of the reasons a derived price is always marked as an estimate.
 */
const CONSUMABLE_TYPES = new Set(['Potion', 'Scroll'])

export interface ItemPrice {
  /** Value in copper pieces. */
  cp: number
  /** True when derived from rarity rather than printed in the source. */
  estimated: boolean
}

/** The subset of an item the price depends on, so callers can pass a literal. */
type Priceable = Pick<Item, 'valueCp' | 'rarity' | 'typeName'>

/**
 * Price of an item, or undefined when it has none (artifacts, and mundane items
 * the source leaves unpriced).
 *
 * A price printed in the source always wins: most magic items have only a
 * rarity, but the few that carry both disagree with the table often enough to
 * matter — a Spell Scroll (Cantrip) lists 30 GP where the rarity would derive 50.
 */
export function itemPrice(item: Priceable): ItemPrice | undefined {
  const { valueCp } = item
  if (valueCp != null && Number.isFinite(valueCp) && valueCp > 0) {
    return { cp: valueCp, estimated: false }
  }
  // Note: the compendium's rarity filter substitutes a synthetic "mundane" for
  // items with no rarity. That value is a UI label and never reaches here.
  const gp = RARITY_GP[item.rarity?.trim().toLowerCase() ?? '']
  if (gp === undefined) return undefined
  const halved = CONSUMABLE_TYPES.has(item.typeName) ? gp / 2 : gp
  return { cp: halved * 100, estimated: true }
}

/** 1234567 -> "1,234,567". Hand-rolled: toLocaleString would follow the device
 *  locale, which swaps "." and "," in much of Europe and would make the output
 *  — and the tests — machine-dependent. */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Copper pieces as coins, in the largest denomination that divides evenly:
 *  2500 -> "25 GP", 50 -> "5 SP", 2 -> "2 CP". A handful of items are priced
 *  below a copper (a Sling Bullet is 0.2 CP), so fractions are kept as decimals. */
export function formatCoins(cp: number): string {
  if (cp % 100 === 0) return `${group(cp / 100)} GP`
  if (cp % 10 === 0) return `${group(cp / 10)} SP`
  if (Number.isInteger(cp)) return `${group(cp)} CP`
  return `${cp.toFixed(2).replace(/\.?0+$/, '')} CP`
}

/** Ready-to-render price for an item, or undefined when it has none. */
export function itemPriceLabel(item: Priceable): { text: string; estimated: boolean } | undefined {
  const price = itemPrice(item)
  return price && { text: formatCoins(price.cp), estimated: price.estimated }
}
