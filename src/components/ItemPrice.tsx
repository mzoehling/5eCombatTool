import { itemPriceLabel } from '../lib/itemPrice'
import type { Item } from '../types'

/** Why an estimate is an estimate — most magic items carry only a rarity. */
const ESTIMATE_TITLE = 'Estimated from the item’s rarity — no price is printed for it'

/**
 * An item's price, or nothing when it has none (artifacts, and mundane items
 * the source leaves unpriced). A derived price is marked with "≈" so it is
 * never mistaken for one printed in the source.
 */
export function ItemPrice({ item, prefix }: { item: Item; prefix?: string }) {
  const price = itemPriceLabel(item)
  if (!price) return null
  return (
    <>
      {prefix}
      <span className={price.estimated ? 'price est' : 'price'} title={price.estimated ? ESTIMATE_TITLE : undefined}>
        {price.estimated ? '≈ ' : ''}
        {price.text}
      </span>
    </>
  )
}
