import { useLiveQuery } from 'dexie-react-hooks'
import { findRuleByName, originLabel } from '../data/compendium'
import { provenanceLabel } from '../lib/format'
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
}

/** Full rules-glossary text for a term. A body in the reference drawer's stack —
 *  the drawer owns the shell and the way back. */
export function RuleInfo({ name, ...handlers }: RuleInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findRuleByName(name)) ?? null, [name])

  if (found === undefined) return <p className="dim">Loading…</p>
  if (found === null) return <p className="dim">This rule isn’t in the rules glossary (SRD).</p>

  const { entry: rule, origin } = found

  return (
    <>
      <p className="spell-meta dim">{provenanceLabel(originLabel(origin), rule.source, rule.page)}</p>
      {rule.text.map((t, i) => (
        <p key={i}>
          <TaggedText text={t} {...handlers} />
        </p>
      ))}
    </>
  )
}
