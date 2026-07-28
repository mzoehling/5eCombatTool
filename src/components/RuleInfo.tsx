import { useLiveQuery } from 'dexie-react-hooks'
import { findRuleByName, originLabel } from '../data/compendium'
import { provenanceLabel } from '../lib/format'
import { Modal } from './Modal'
import { TaggedText } from './TaggedText'

interface RuleInfoProps {
  /** Rule name from a {@variantrule} reference. */
  name: string
  onDice?: (expr: string) => void
  onCondition?: (name: string) => void
  onSpell?: (name: string) => void
  onItem?: (name: string) => void
  onCreature?: (name: string) => void
  /** Rule links inside rule text replace the shown rule. */
  onRule?: (name: string) => void
  onClose: () => void
}

/** Full rules-glossary text for a term, looked up in the compendium (SRD). */
export function RuleInfo({ name, onClose, ...handlers }: RuleInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findRuleByName(name)) ?? null, [name])

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
        <p className="dim">This rule isn’t in the rules glossary (SRD).</p>
      </Modal>
    )
  }

  const { entry: rule, origin } = found

  return (
    <Modal title={rule.name} onClose={onClose}>
      <p className="spell-meta dim">{provenanceLabel(originLabel(origin), rule.source, rule.page)}</p>
      {rule.text.map((t, i) => (
        <p key={i}>
          <TaggedText text={t} {...handlers} />
        </p>
      ))}
    </Modal>
  )
}
