import { useLiveQuery } from 'dexie-react-hooks'
import { findSpellByName } from '../data/compendium'
import { Modal } from './Modal'
import { TaggedText } from './TaggedText'

interface SpellInfoProps {
  /** Spell name from a {@spell} reference. */
  name: string
  onDice?: (expr: string) => void
  onCondition?: (name: string) => void
  /** Spell links inside spell text replace the shown spell. */
  onSpell?: (name: string) => void
  onItem?: (name: string) => void
  onCreature?: (name: string) => void
  onClose: () => void
}

/** Full rules text for a spell, looked up in the compendium (SRD + packs). */
export function SpellInfo({ name, onClose, ...handlers }: SpellInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const spell = useLiveQuery(async () => (await findSpellByName(name)) ?? null, [name])

  if (spell === undefined) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">Loading…</p>
      </Modal>
    )
  }

  if (spell === null) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">This spell isn’t in the compendium (SRD + imported packs).</p>
      </Modal>
    )
  }

  return (
    <Modal title={spell.name} onClose={onClose}>
      <p className="spell-meta dim">
        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.school}
        {spell.concentration && ' · Concentration'}
        {spell.ritual && ' · Ritual'}
      </p>
      <p className="spell-meta">
        Casting Time: {spell.castingTime} · Range: {spell.range} · Duration: {spell.duration}
      </p>
      <p className="spell-meta">Components: {spell.components}</p>
      {spell.text.map((t, i) => (
        <p key={i}>
          <TaggedText text={t} {...handlers} />
        </p>
      ))}
      {spell.higherLevel.length > 0 && (
        <>
          <h3>Using a Higher-Level Spell Slot</h3>
          {spell.higherLevel.map((t, i) => (
            <p key={i}>
              <TaggedText text={t} {...handlers} />
            </p>
          ))}
        </>
      )}
    </Modal>
  )
}
