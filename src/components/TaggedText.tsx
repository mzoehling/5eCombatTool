import { renderTags, renderTagSegments, type TagSegment } from '../lib/tagRenderer'

type RefKind = 'condition' | 'spell' | 'item' | 'creature' | 'rule'

interface TaggedTextProps {
  text: string
  /** When set, dice expressions and attack bonuses render as clickable links. */
  onDice?: (expr: string) => void
  /** When set, condition names render as clickable links. */
  onCondition?: (name: string) => void
  /** When set, {@spell} references render as clickable links. */
  onSpell?: (name: string) => void
  /** When set, {@item} references render as clickable links. */
  onItem?: (name: string) => void
  /** When set, {@creature} references render as clickable links. */
  onCreature?: (name: string) => void
  /** When set, {@variantrule} references render as clickable links. */
  onRule?: (name: string) => void
}

type Handlers = Omit<TaggedTextProps, 'text'>

const REF_STYLE: Record<RefKind, { className: string; title: string }> = {
  condition: { className: 'condition-link', title: 'rules and apply' },
  spell: { className: 'spell-link', title: 'spell description' },
  item: { className: 'item-link', title: 'item description' },
  creature: { className: 'creature-link', title: 'statblock' },
  rule: { className: 'rule-link', title: 'rules glossary' },
}

function refHandler(ref: RefKind, handlers: Handlers): ((name: string) => void) | undefined {
  switch (ref) {
    case 'condition':
      return handlers.onCondition
    case 'spell':
      return handlers.onSpell
    case 'item':
      return handlers.onItem
    case 'creature':
      return handlers.onCreature
    case 'rule':
      return handlers.onRule
  }
}

function segmentNode(segment: TagSegment, key: number, handlers: Handlers) {
  if (segment.kind === 'dice' && handlers.onDice) {
    const { onDice } = handlers
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
  if (segment.kind === 'ref') {
    const handler = refHandler(segment.ref, handlers)
    if (handler) {
      const { className, title } = REF_STYLE[segment.ref]
      return (
        <button
          key={key}
          type="button"
          className={className}
          title={`${segment.name} — ${title}`}
          onClick={() => handler(segment.name)}
        >
          {segment.display}
        </button>
      )
    }
  }
  return segment.kind === 'text' ? segment.text : segment.display
}

/** Statblock text with {@…} tags resolved; dice and known references become links. */
export function TaggedText({ text, ...handlers }: TaggedTextProps) {
  if (
    !handlers.onDice &&
    !handlers.onCondition &&
    !handlers.onSpell &&
    !handlers.onItem &&
    !handlers.onCreature &&
    !handlers.onRule
  ) {
    return <>{renderTags(text)}</>
  }
  return <>{renderTagSegments(text).map((segment, i) => segmentNode(segment, i, handlers))}</>
}
