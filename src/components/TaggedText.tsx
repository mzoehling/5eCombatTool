import { renderTags, renderTagSegments } from '../lib/tagRenderer'

interface TaggedTextProps {
  text: string
  /** When set, dice expressions and attack bonuses render as clickable links. */
  onDice?: (expr: string) => void
}

/** Statblock text with {@…} tags resolved; rollable dice become links. */
export function TaggedText({ text, onDice }: TaggedTextProps) {
  if (!onDice) return <>{renderTags(text)}</>
  return (
    <>
      {renderTagSegments(text).map((segment, i) =>
        segment.kind === 'text' ? (
          segment.text
        ) : (
          <button
            key={i}
            type="button"
            className="dice-link"
            title={`Roll ${segment.expr}`}
            onClick={() => onDice(segment.expr)}
          >
            {segment.display}
          </button>
        ),
      )}
    </>
  )
}
