import { renderTags, renderTagSegments, type TagSegment } from '../lib/tagRenderer'

interface TaggedTextProps {
  text: string
  /** When set, dice expressions and attack bonuses render as clickable links. */
  onDice?: (expr: string) => void
  /** When set, condition names render as clickable links. */
  onCondition?: (name: string) => void
  /** When set, {@spell} references render as clickable links. */
  onSpell?: (name: string) => void
}

function segmentNode(segment: TagSegment, key: number, { onDice, onCondition, onSpell }: Omit<TaggedTextProps, 'text'>) {
  if (segment.kind === 'dice' && onDice) {
    return (
      <button
        key={key}
        type="button"
        className="dice-link"
        title={`Roll ${segment.expr}`}
        onClick={() => onDice(segment.expr)}
      >
        {segment.display}
      </button>
    )
  }
  if (segment.kind === 'ref' && segment.ref === 'condition' && onCondition) {
    return (
      <button
        key={key}
        type="button"
        className="condition-link"
        title={`${segment.name} — rules and apply`}
        onClick={() => onCondition(segment.name)}
      >
        {segment.display}
      </button>
    )
  }
  if (segment.kind === 'ref' && segment.ref === 'spell' && onSpell) {
    return (
      <button
        key={key}
        type="button"
        className="spell-link"
        title={`${segment.name} — spell description`}
        onClick={() => onSpell(segment.name)}
      >
        {segment.display}
      </button>
    )
  }
  return segment.kind === 'text' ? segment.text : segment.display
}

/** Statblock text with {@…} tags resolved; dice, conditions and spells become links. */
export function TaggedText({ text, onDice, onCondition, onSpell }: TaggedTextProps) {
  if (!onDice && !onCondition && !onSpell) return <>{renderTags(text)}</>
  return <>{renderTagSegments(text).map((segment, i) => segmentNode(segment, i, { onDice, onCondition, onSpell }))}</>
}
