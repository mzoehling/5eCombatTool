import { mdiDiceMultiple } from '@mdi/js'
import { useRef, useState } from 'react'
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

const MODES: { id: RollMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'advantage', label: 'Advantage' },
  { id: 'disadvantage', label: 'Disadvantage' },
]

export function DiceRoller({ onClose, initialExpression = '', allowApply = false }: DiceRollerProps) {
  const [text, setText] = useState(initialExpression)
  const [mode, setMode] = useState<RollMode>('normal')
  const [invalid, setInvalid] = useState(false)
  const [history, setHistory] = useState<ModedRollResult[]>([])
  const [applyAmount, setApplyAmount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const critExpression = doubleDiceTerms(text)

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
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const latest = history[0]

  return (
    <Modal title="Dice Roller" onClose={onClose}>
      <div className="dice-form">
        <input
          ref={inputRef}
          autoFocus
          placeholder="e.g. 1w8, 2d6 + 3, 3w8+5+2w4"
          value={text}
          aria-label="Dice expression"
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && doRoll()}
        />
        <button type="button" className="primary icon-label" onClick={doRoll}>
          <Icon path={mdiDiceMultiple} /> Roll
        </button>
      </div>

      <div className="dice-mode" role="group" aria-label="Roll mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? 'primary' : ''}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          className="crit-btn"
          disabled={!critExpression}
          title="Double the dice — critical hit"
          onClick={() => {
            if (!critExpression) return
            setText(critExpression)
            inputRef.current?.focus()
          }}
        >
          Crit ×2
        </button>
      </div>

      {invalid && <p className="dice-error">Not a valid dice expression — try something like “2d6 + 3” or “1w8”.</p>}

      {latest && (
        <div className="dice-result" aria-live="polite">
          <div className="dice-total">{latest.kept.total}</div>
          {latest.discarded && (
            <div className="dice-discarded">
              {latest.mode === 'advantage' ? 'Advantage' : 'Disadvantage'} — discarded <s>{latest.discarded.total}</s>{' '}
              ({formatBreakdown(latest.discarded)})
            </div>
          )}
          <div className="dice-breakdown">
            {latest.kept.input} → {formatBreakdown(latest.kept)}
          </div>
          {allowApply && (
            <button type="button" className="apply-roll-btn" onClick={() => setApplyAmount(latest.kept.total)}>
              Apply to combatants…
            </button>
          )}
        </div>
      )}

      {applyAmount !== null && <ApplyRoll amount={applyAmount} onClose={() => setApplyAmount(null)} />}

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
                <span className="dice-history-total">{r.kept.total}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
