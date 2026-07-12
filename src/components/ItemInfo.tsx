import { useLiveQuery } from 'dexie-react-hooks'
import { findItemByName } from '../data/compendium'
import { Modal } from './Modal'
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
  onClose: () => void
}

/** Full rules text for an item, looked up in the compendium (SRD + packs). */
export function ItemInfo({ name, onClose, ...handlers }: ItemInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const item = useLiveQuery(async () => (await findItemByName(name)) ?? null, [name])

  if (item === undefined) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">Loading…</p>
      </Modal>
    )
  }

  if (item === null) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">This item isn’t in the compendium (SRD + imported packs).</p>
      </Modal>
    )
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      <p className="spell-meta dim">
        {item.typeName}
        {item.rarity && ` · ${item.rarity}`}
      </p>
      {item.attunement && (
        <p className="spell-meta dim">
          <TaggedText text={item.attunement} {...handlers} />
        </p>
      )}
      {item.text.map((t, i) => (
        <p key={i}>
          <TaggedText text={t} {...handlers} />
        </p>
      ))}
      {item.text.length === 0 && <p className="dim">No rules text.</p>}
    </Modal>
  )
}
