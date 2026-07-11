import { renderTags, renderTagSegments, type TagSegment } from '../lib/tagRenderer'

interface TaggedTextProps {
  text: string
  /** When set, dice expressions and attack bonuses render as clickable links. */
  onDice?: (expr: string) => void
  /** When set, condition names render as clickable links. */
  onCondition?: (name: string) => void
}

function segmentNode(segment: TagSegment, key: number, { onDice, onCondition }: Omit<TaggedTextProps, 'text'>) {
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
  if (segment.kind === 'ref' && onCondition) {
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
  return segment.kind === 'text' ? segment.text : segment.display
}

/** Statblock text with {@…} tags resolved; dice and conditions become links. */
export function TaggedText({ text, onDice, onCondition }: TaggedTextProps) {
  if (!onDice && !onCondition) return <>{renderTags(text)}</>
  return <>{renderTagSegments(text).map((segment, i) => segmentNode(segment, i, { onDice, onCondition }))}</>
}
