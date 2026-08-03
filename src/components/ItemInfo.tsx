import { useLiveQuery } from 'dexie-react-hooks'
import { findItemByName, originLabel } from '../data/compendium'
import { provenanceLabel } from '../lib/format'
import { itemStatsLine } from '../lib/itemPrice'
import { StatLine } from './StatLine'
import { TaggedText } from './TaggedText'

interface ItemInfoProps {
  /** Item name from an {@item} reference. */
  name: string
  onDice?: (expr: string) => void
  onCondition?: (name: string) => void
  onSpell?: (name: string) => void
  /** Item links inside item text replace the shown item. */
  onItem?: (name: string) => void
  onCreature?: (name: string) => void
  onRule?: (name: string) => void
}

/** Full rules text for an item. A body in the reference drawer's stack — the
 *  drawer owns the shell and the way back. */
export function ItemInfo({ name, ...handlers }: ItemInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findItemByName(name)) ?? null, [name])

  if (found === undefined) return <p className="dim">Loading…</p>
  if (found === null) return <p className="dim">This item isn’t in the compendium (SRD + imported packs).</p>

  const { entry: item, origin } = found
  const stats = itemStatsLine(item)

  return (
    <>
      <p className="sheet-meta">{provenanceLabel(originLabel(origin), item.source, item.page)}</p>
      <StatLine
        stats={[
          { label: 'Type', value: item.typeName },
          { label: 'Rarity', value: item.rarity },
          item.attunement && {
            label: 'Attunement',
            value: <TaggedText text={item.attunement} {...handlers} />,
          },
          // Price and weight come from itemStatsLine, which marks a price
          // derived from rarity with "≈".
          { label: 'Price / weight', value: stats },
        ]}
      />
      {item.text.map((t, i) => (
        <p key={i}>
          <TaggedText text={t} {...handlers} />
        </p>
      ))}
      {item.text.length === 0 && <p className="dim">No rules text.</p>}
    </>
  )
}
