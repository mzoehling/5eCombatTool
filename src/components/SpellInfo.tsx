import { useLiveQuery } from 'dexie-react-hooks'
import { findSpellByName, originLabel } from '../data/compendium'
import { provenanceLabel } from '../lib/format'
import { Modal } from './Modal'
import { StatLine } from './StatLine'
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
  onRule?: (name: string) => void
  onClose: () => void
}

/** Full rules text for a spell, looked up in the compendium (SRD + packs). */
export function SpellInfo({ name, onClose, ...handlers }: SpellInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findSpellByName(name)) ?? null, [name])

  if (found === undefined) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">Loading…</p>
      </Modal>
    )
  }

  if (found === null) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">This spell isn’t in the compendium (SRD + imported packs).</p>
      </Modal>
    )
  }

  const { entry: spell, origin } = found

  return (
    <Modal title={spell.name} onClose={onClose}>
      <p className="sheet-meta">
        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.school}
        {` · ${provenanceLabel(originLabel(origin), spell.source, spell.page)}`}
      </p>
      <StatLine
        stats={[
          { label: 'Casting', value: spell.castingTime },
          { label: 'Range', value: spell.range },
          { label: 'Duration', value: spell.duration },
          { label: 'Components', value: spell.components },
          // Concentration and ritual were chips of their own; they are tags on
          // the same line now rather than a second row.
          (spell.concentration || spell.ritual) && {
            label: 'Tags',
            value: [spell.concentration && 'Concentration', spell.ritual && 'Ritual'].filter(Boolean).join(' · '),
          },
        ]}
      />
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
