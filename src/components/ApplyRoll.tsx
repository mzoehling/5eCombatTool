import { useState } from 'react'
import { sortedCombatants } from '../store/battleReducer'
import { battleStore, useBattleState } from '../store/battleStore'
import { Modal } from './Modal'

interface ApplyRollProps {
  /** Rolled total to apply as damage or healing. */
  amount: number
  onClose: () => void
}

/** Applies a rolled total to picked combatants; per-target half for made saves. */
export function ApplyRoll({ amount, onClose }: ApplyRollProps) {
  const { dispatch } = battleStore
  const { combatants } = useBattleState()
  const ordered = sortedCombatants(combatants)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [halved, setHalved] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, update: (next: Set<string>) => void, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update(next)
  }

  const apply = (heal: boolean) => {
    const fullIds = [...selected].filter((id) => !halved.has(id))
    const halfIds = [...selected].filter((id) => halved.has(id))
    const type = heal ? ('applyHealing' as const) : ('applyDamage' as const)
    if (fullIds.length) dispatch({ type, ids: fullIds, amount })
    if (halfIds.length && Math.floor(amount / 2) > 0) dispatch({ type, ids: halfIds, amount: Math.floor(amount / 2) })
    onClose()
  }

  return (
    <Modal title={`Apply ${amount}`} onClose={onClose}>
      <ul className="apply-list">
        {ordered.map((c) => (
          <li key={c.id} className="apply-roll-row">
            <label className="check">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(selected, setSelected, c.id)}
              />
              {c.name}
              <span className="dim"> {c.hp}/{c.maxHp}</span>
            </label>
            {selected.has(c.id) && (
              <button
                type="button"
                className={halved.has(c.id) ? 'half-btn primary' : 'half-btn'}
                aria-pressed={halved.has(c.id)}
                title="Half (save succeeded)"
                onClick={() => toggle(halved, setHalved, c.id)}
              >
                ½ {halved.has(c.id) ? Math.floor(amount / 2) : ''}
              </button>
            )}
          </li>
        ))}
        {ordered.length === 0 && <li className="dim">No combatants in the tracker.</li>}
      </ul>

      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ok" disabled={selected.size === 0} onClick={() => apply(true)}>
          Heal
        </button>
        <button type="button" className="danger" disabled={selected.size === 0} onClick={() => apply(false)}>
          Damage {selected.size} {selected.size === 1 ? 'target' : 'targets'}
        </button>
      </div>
    </Modal>
  )
}
