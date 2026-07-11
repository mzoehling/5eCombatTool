import { mdiDiceMultiple } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { formatBreakdown, rollDiceExpression, type DiceRollResult } from '../lib/diceExpr'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface DiceRollerProps {
  onClose: () => void
  /** Pre-filled expression (rolled immediately) — used by clickable damage links. */
  initialExpression?: string
}

export function DiceRoller({ onClose, initialExpression = '' }: DiceRollerProps) {
  const [text, setText] = useState(initialExpression)
  const [invalid, setInvalid] = useState(false)
  const [history, setHistory] = useState<DiceRollResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const doRoll = (expression: string) => {
    const result = rollDiceExpression(expression)
    if (!result) {
      setInvalid(expression.trim().length > 0)
      return
    }
    setInvalid(false)
    setHistory((h) => [result, ...h].slice(0, 10))
  }

  // a pre-filled expression rolls right away (clickable damage links)
  useEffect(() => {
    if (initialExpression) doRoll(initialExpression)
    inputRef.current?.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const latest = history[0]

  return (
    <Modal title="Dice Roller" onClose={onClose}>
      <div className="inline-form">
        <input
          ref={inputRef}
          autoFocus
          placeholder="e.g. 1w8, 2d6 + 3, 3w8+5+2w4"
          value={text}
          aria-label="Dice expression"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doRoll(text)}
        />
        <button type="button" className="primary icon-label" onClick={() => doRoll(text)}>
          <Icon path={mdiDiceMultiple} /> Roll
        </button>
      </div>

      {invalid && <p className="error-text">Not a valid dice expression — try something like “2d6 + 3” or “1w8”.</p>}

      {latest && (
        <div className="dice-result" aria-live="polite">
          <div className="dice-total">{latest.total}</div>
          <div className="dice-breakdown">
            {latest.input} → {formatBreakdown(latest)}
          </div>
        </div>
      )}

      {history.length > 1 && (
        <ul className="dice-history">
          {history.slice(1).map((r, i) => (
            <li key={i}>
              <span className="dim">{r.input}</span>
              <span className="dice-history-total">{r.total}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
