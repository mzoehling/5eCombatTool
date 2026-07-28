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
 * of the reasons a derived price is always labelled as an estimate.
 */
const CONSUMABLE_TYPES = new Set(['Potion', 'Scroll'])

export interface ItemPrice {
  /** Price printed in the source, in copper pieces. */
  listedCp?: number
  /** Price derived from rarity, in copper pieces. */
  derivedCp?: number
}

/** The subset of an item pricing depends on, so callers can pass a literal. */
type Priceable = Pick<Item, 'valueCp' | 'rarity' | 'typeName'>

/**
 * Both prices an item can have, or undefined when it has neither (artifacts,
 * and mundane gear the source leaves unpriced).
 *
 * The two are kept apart rather than resolved to one number: where a source
 * prints a price *and* the rarity implies one, they can disagree — a Spell
 * Scroll (Cantrip) lists 30 GP where its rarity derives 50 — and which to
 * charge is the DM's call, not this function's.
 */
export function itemPrice(item: Priceable): ItemPrice | undefined {
  const price: ItemPrice = {}
  const { valueCp } = item
  if (valueCp != null && Number.isFinite(valueCp) && valueCp > 0) price.listedCp = valueCp
  // Note: the compendium's rarity filter substitutes a synthetic "mundane" for
  // items with no rarity. That value is a UI label and never reaches here.
  const gp = RARITY_GP[item.rarity?.trim().toLowerCase() ?? '']
  if (gp !== undefined) {
    price.derivedCp = (CONSUMABLE_TYPES.has(item.typeName) ? gp / 2 : gp) * 100
  }
  return price.listedCp === undefined && price.derivedCp === undefined ? undefined : price
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

/**
 * The price as one short string, for a list row: the printed price when there
 * is one, otherwise the rarity estimate marked with "≈".
 */
export function itemPriceShort(item: Priceable): string | undefined {
  const price = itemPrice(item)
  if (!price) return undefined
  if (price.listedCp !== undefined) return formatCoins(price.listedCp)
  return `≈ ${formatCoins(price.derivedCp!)}`
}

/** What to order an item by when sorting on price. Undefined items sort last. */
export function itemPriceSortValue(item: Priceable): number | undefined {
  const price = itemPrice(item)
  return price && (price.listedCp ?? price.derivedCp)
}

/** "1 lb." — items are weighed in pounds, whole or fractional. */
export function formatWeight(weight: number): string {
  return `${weight} lb.`
}

/**
 * Price and weight for an item's detail view: "Price: 30 GP · rarity estimate
 * ≈ 50 GP · Weight: 1 lb."
 *
 * Both prices are shown when both exist and disagree, so the DM can see the
 * printed figure and what the rarity table would have charged. When they agree
 * there is nothing to compare, so only one is shown.
 */
export function itemStatsLine(item: Priceable & Pick<Item, 'weight'>): string | undefined {
  const parts: string[] = []
  const price = itemPrice(item)
  if (price?.listedCp !== undefined) {
    parts.push(`Price: ${formatCoins(price.listedCp)}`)
    if (price.derivedCp !== undefined && price.derivedCp !== price.listedCp) {
      parts.push(`rarity estimate ≈ ${formatCoins(price.derivedCp)}`)
    }
  } else if (price?.derivedCp !== undefined) {
    parts.push(`Price: ≈ ${formatCoins(price.derivedCp)} (estimated from rarity)`)
  }
  if (item.weight !== undefined) parts.push(`Weight: ${formatWeight(item.weight)}`)
  return parts.length ? parts.join(' · ') : undefined
}
