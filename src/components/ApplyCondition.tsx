import { useState } from 'react'
import { describeCondition } from '../data/conditionInfo'
import { sortedCombatants } from '../store/battleReducer'
import { battleStore, useBattleState } from '../store/battleStore'
import { CONDITIONS, type ConditionInstance } from '../types'
import { Checkbox } from './Checkbox'
import { Modal } from './Modal'

interface ApplyConditionProps {
  /** Canonical condition name (e.g. "Prone"). */
  name: string
  /** Combatants pre-checked in the apply list (AoE selection). */
  preselect?: ReadonlySet<string>
  /** Set when the dialog was opened without a condition in mind (AoE bar),
   *  in which case it offers a picker instead of a fixed condition. */
  onPickCondition?: (name: string) => void
  onClose: () => void
}

/** Rules text for a condition plus a form to apply it to combatants. */
export function ApplyCondition({ name, preselect, onPickCondition, onClose }: ApplyConditionProps) {
  const { dispatch } = battleStore
  const { combatants } = useBattleState()
  const ordered = sortedCombatants(combatants)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...(preselect ?? [])].filter((id) => combatants.some((c) => c.id === id))),
  )
  const [rounds, setRounds] = useState('')
  const [level, setLevel] = useState('1')

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const apply = () => {
    const parsedRounds = Number.parseInt(rounds, 10)
    const condition: ConditionInstance = {
      condition: name,
      ...(Number.isFinite(parsedRounds) && parsedRounds > 0 && { remainingRounds: parsedRounds }),
      ...(name === 'Exhaustion' && { level: Math.min(6, Math.max(1, Number.parseInt(level, 10) || 1)) }),
    }
    for (const id of selected) dispatch({ type: 'setCondition', id, condition })
    onClose()
  }

  return (
    <Modal title={name} onClose={onClose}>
      {onPickCondition && (
        <label className="apply-picker">
          Condition
          <select value={name} onChange={(e) => onPickCondition(e.target.value)}>
            {CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* The rules text comes first: it is why this dialog was opened. */}
      <p className="condition-rules">{describeCondition(name) ?? 'Custom effect — no rules text.'}</p>

      <h3 className="condition-heading">Apply to</h3>
      <ul className="apply-list">
        {ordered.map((c) => (
          <li key={c.id}>
            <label className="check">
              <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} ariaLabel={c.name} />
              {c.name}
            </label>
          </li>
        ))}
        {ordered.length === 0 && <li className="dim">No combatants in the tracker.</li>}
      </ul>

      <div className="apply-options">
        <label>
          Duration (rounds)
          <input
            inputMode="numeric"
            placeholder="until removed"
            value={rounds}
            onChange={(e) => setRounds(e.target.value)}
          />
        </label>
        {name === 'Exhaustion' && (
          <label>
            Level (1–6)
            <input inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <span className="spacer" />
        <button type="button" className="primary" disabled={selected.size === 0} onClick={apply}>
          Apply to {selected.size} {selected.size === 1 ? 'combatant' : 'combatants'}
        </button>
      </div>
    </Modal>
  )
}
