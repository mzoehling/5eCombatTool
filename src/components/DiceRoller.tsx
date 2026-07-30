import { mdiChevronDown, mdiChevronRight, mdiDiceMultiple } from '@mdi/js'
import { memo, useRef, useState } from 'react'
import './diceRoller.css'
import { doubleDiceTerms, formatBreakdown, rollWithMode, type ModedRollResult, type RollMode } from '../lib/diceExpr'
import { ApplyRoll } from './ApplyRoll'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface DiceRollerProps {
  onClose: () => void
  /** Pre-filled expression (not rolled yet) — used by clickable dice links. */
  initialExpression?: string
  /** Show "Apply…" on results to damage/heal combatants (DM view only). */
  allowApply?: boolean
}

/* Short labels because the group has to fit the width of the dice pad on a
   phone; the full word stays as the accessible name. ADV/DIS is the shorthand
   the rest of the app already uses. */
const MODES: { id: RollMode; label: string; full: string }[] = [
  { id: 'normal', label: 'Normal', full: 'Normal' },
  { id: 'advantage', label: 'ADV', full: 'Advantage' },
  { id: 'disadvantage', label: 'DIS', full: 'Disadvantage' },
]

const DICE = [4, 6, 8, 10, 12, 20] as const

type DiceCounts = Partial<Record<(typeof DICE)[number], number>>

/** Composes the pad's state into the notation both input models share. */
export function composeExpression(counts: DiceCounts, bonus: number): string {
  const terms = DICE.filter((sides) => (counts[sides] ?? 0) > 0).map((sides) => `${counts[sides]}d${sides}`)
  // The sign comes from the join, not from the term: writing "+5" here and
  // then joining on "+" produced "1d3++5", which is not a valid expression.
  if (bonus !== 0) terms.push(String(bonus))
  return terms.join('+').replace(/\+-/g, '-')
}

/* Select-all on focus is a desktop convenience — typing then replaces the old
   expression. On a touch keyboard it is harmful: the field is handed to the
   IME with a full selection instead of a caret, and Android keyboards (Firefox
   for Android especially) then drop the keystrokes that follow. */
const SELECT_ON_FOCUS = typeof matchMedia === 'function' && !matchMedia('(pointer: coarse)').matches

/* `memo` so a re-rendering parent cannot rewrite the field mid-keystroke: the
   Player View re-renders on every snapshot the DM broadcasts, and each of those
   made React write its own `text` back over the input. A soft keyboard that is
   still composing loses what it had, which reads as "the field ignores me". */
export const DiceRoller = memo(function DiceRoller({
  onClose,
  initialExpression = '',
  allowApply = false,
}: DiceRollerProps) {
  const [text, setText] = useState(initialExpression)
  const [mode, setMode] = useState<RollMode>('normal')
  const [invalid, setInvalid] = useState(false)
  const [history, setHistory] = useState<ModedRollResult[]>([])
  const [applyAmount, setApplyAmount] = useState<number | null>(null)
  // Pad state. `text` stays the single source of truth for what gets rolled;
  // the pad simply writes into it, so notation typed by hand is never lost
  // until the next pad tap recomposes the expression.
  const [counts, setCounts] = useState<DiceCounts>({})
  const [bonus, setBonus] = useState(0)
  const [showNotation, setShowNotation] = useState(initialExpression.length > 0)
  const inputRef = useRef<HTMLInputElement>(null)

  const critExpression = doubleDiceTerms(text)

  const writePad = (nextCounts: DiceCounts, nextBonus: number) => {
    setCounts(nextCounts)
    setBonus(nextBonus)
    setText(composeExpression(nextCounts, nextBonus))
    setInvalid(false)
  }

  const addDie = (sides: (typeof DICE)[number], delta: number) => {
    const next = { ...counts, [sides]: Math.max(0, (counts[sides] ?? 0) + delta) }
    writePad(next, bonus)
  }

  const clearPad = () => writePad({}, 0)

  const doRoll = () => {
    const result = rollWithMode(text, mode)
    if (!result) {
      setInvalid(text.trim().length > 0)
      return
    }
    setInvalid(false)
    setHistory((h) => [result, ...h].slice(0, 10))
  }

  const recall = (expression: string) => {
    setText(expression)
    setShowNotation(true)
    inputRef.current?.focus()
    if (SELECT_ON_FOCUS) inputRef.current?.select()
  }

  const latest = history[0]

  return (
    <Modal title="Dice Roller" className="dice-modal modal-split" onClose={onClose}>
      <div className="dice-layout">
        {/* Left column on iPad: the pad never scrolls out of reach while
            rolling, because only the result column moves. */}
        <div className="dice-pad-col">
          <div className="dice-pad" role="group" aria-label="Dice">
            {DICE.map((sides) => (
              <button
                key={sides}
                type="button"
                className="die-btn"
                title={`Add a d${sides} — press and hold to remove one`}
                onClick={() => addDie(sides, 1)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  addDie(sides, -1)
                }}
              >
                d{sides}
                {(counts[sides] ?? 0) > 0 && <span className="die-count">{counts[sides]}</span>}
              </button>
            ))}
          </div>

          {/* Crit shares this row: the stepper sits against its label, which
              leaves room, and doubling the dice is a change to the pool the pad
              above describes — nearer to it than to the footer's actions. */}
          <div className="dice-bonus">
            <span className="dice-bonus-label">Bonus</span>
            <div className="stepper">
              <button type="button" aria-label="Lower bonus" onClick={() => writePad(counts, bonus - 1)}>
                −
              </button>
              <span className="dice-bonus-value num">{bonus >= 0 ? `+${bonus}` : bonus}</span>
              <button type="button" aria-label="Raise bonus" onClick={() => writePad(counts, bonus + 1)}>
                +
              </button>
            </div>
            <button
              type="button"
              className="crit-btn"
              disabled={!critExpression}
              title="Double the dice — critical hit"
              onClick={() => {
                if (!critExpression) return
                setText(critExpression)
              }}
            >
              Crit ×2
            </button>
          </div>

          {/* Under the pad rather than in the footer: three words plus the crit
              button could not share a phone's footer with Roll without being
              squeezed into an unreadable strip. Here the group is exactly as
              wide as the dice pad above it. */}
          <div className="dice-mode segments" role="group" aria-label="Roll mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                aria-label={m.full}
                title={m.full}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Notation stays available for compound rolls the pad cannot build,
              writing into the same expression state. */}
          <button
            type="button"
            className="ghost dice-notation-toggle"
            aria-expanded={showNotation}
            onClick={() => setShowNotation(!showNotation)}
          >
            <Icon path={showNotation ? mdiChevronDown : mdiChevronRight} /> Notation
            {!showNotation && text && <span className="dim"> · {text}</span>}
          </button>
          {showNotation && (
            <input
              ref={inputRef}
              placeholder="e.g. 1w8, 2d6 + 3, 3w8+5+2w4"
              value={text}
              aria-label="Dice expression"
              /* Dice notation is not prose: autocorrect would "fix" 1w8, and
                 auto-capitalisation and suggestion strips make Android keyboards
                 compose the field instead of committing each key. */
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => SELECT_ON_FOCUS && e.target.select()}
              onKeyDown={(e) => e.key === 'Enter' && doRoll()}
            />
          )}
        </div>

        <div className="dice-result-col">
          {invalid && (
            <p className="dice-error">Not a valid dice expression — try something like “2d6 + 3” or “1w8”.</p>
          )}

          {latest ? (
            <div className="dice-result" aria-live="polite">
              <div className="dice-expression">{latest.kept.input}</div>
              <div className="dice-total num">{latest.kept.total}</div>
              <div className="dice-breakdown">{formatBreakdown(latest.kept)}</div>
              {latest.discarded && (
                <div className="dice-discarded">
                  {latest.mode === 'advantage' ? 'Advantage' : 'Disadvantage'} — discarded{' '}
                  <s>{latest.discarded.total}</s> ({formatBreakdown(latest.discarded)})
                </div>
              )}
              {allowApply && (
                <button type="button" className="apply-roll-btn" onClick={() => setApplyAmount(latest.kept.total)}>
                  Apply to combatants…
                </button>
              )}
            </div>
          ) : (
            <p className="dim dice-placeholder">Tap dice, then roll.</p>
          )}

          {history.length > 1 && (
            <ul className="dice-history">
              {history.slice(1).map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="dice-history-entry"
                    title={`Use "${r.kept.input}" again`}
                    onClick={() => recall(r.kept.input)}
                  >
                    <span className="dice-history-expr">{r.kept.input}</span>
                    {r.mode !== 'normal' && (
                      <span className="dice-history-mode">{r.mode === 'advantage' ? 'adv' : 'dis'}</span>
                    )}
                    <span className="dice-history-total num">{r.kept.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* On a phone this footer is the thumb zone, so Roll lives here rather
          than next to the expression. */}
      {/* Clear discards, Roll commits; Crit has moved up to the pool it
          modifies. Only Roll is filled. */}
      <div className="modal-footer dice-footer">
        <button type="button" className="dice-clear-btn" onClick={clearPad}>
          Clear
        </button>
        <span className="spacer" />
        <button type="button" className="primary icon-label dice-roll-btn" onClick={doRoll}>
          <Icon path={mdiDiceMultiple} /> Roll
        </button>
      </div>

      {applyAmount !== null && <ApplyRoll amount={applyAmount} onClose={() => setApplyAmount(null)} />}
    </Modal>
  )
})
