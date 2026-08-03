import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useState } from 'react'
import { describeCondition } from '../data/conditionInfo'
import { conditionInstance } from '../lib/conditions'
import { sortedCombatants } from '../store/battleReducer'
import { battleStore, useBattleState } from '../store/battleStore'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface ConditionInfoProps {
  /** Canonical condition name (e.g. "Prone"). */
  name: string
  /** Combatants pre-checked in the apply list — the AoE selection, when armed. */
  preselect?: ReadonlySet<string>
  onClose: () => void
}

/**
 * Rules text for a condition, with a way to apply it.
 *
 * Reading and applying were one form for a while, then split apart so that
 * tapping "Prone" in an attack's text answered the question instead of
 * presenting a checkbox list of the whole tracker. The split went too far: the DM
 * who just read what prone does is usually about to put it on somebody, and
 * making them close this, find the row and hunt through the condition list again
 * was worse than the clutter had been.
 *
 * So the form is here but folded away. Reading costs nothing; applying costs one
 * tap to unfold. The rules text stays visible while targets are picked, because
 * the duration usually depends on what was just read.
 *
 * Nothing is pre-checked from the statblock on screen — a condition read out of a
 * monster's attack lands on its victim, not on the monster. The AoE selection is
 * pre-checked when the bar is armed, since that is the same set of targets the
 * attack was resolved against.
 *
 * `ConditionsDialog` is still the surface for working *from a combatant*
 * outwards; this is the surface for working from a rule inwards. Both build the
 * condition with `conditionInstance` and commit through `dispatchAll`, so
 * duration, exhaustion level and undo behave identically either way.
 */
export function ConditionInfo({ name, preselect, onClose }: ConditionInfoProps) {
  const { combatants } = useBattleState()
  const ordered = sortedCombatants(combatants)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set([...(preselect ?? [])].filter((id) => combatants.some((c) => c.id === id))),
  )
  const [rounds, setRounds] = useState('')
  const [level, setLevel] = useState('1')

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const apply = () => {
    if (selected.size === 0) return
    const condition = conditionInstance(name, rounds, level)
    // One gesture, one undo — see battleStore.dispatchAll.
    battleStore.dispatchAll([...selected].map((id) => ({ type: 'setCondition' as const, id, condition })))
    onClose()
  }

  return (
    <Modal title={name} onClose={onClose}>
      {/* The rules text comes first: it is why this was opened. */}
      <p className="condition-rules">{describeCondition(name) ?? 'Custom effect — no rules text.'}</p>

      {/* Nothing to apply to when the tracker is empty — which is the case when
          this is opened by browsing the compendium rather than mid-fight. */}
      {ordered.length > 0 && (
        <>
          <button
            type="button"
            className="ghost icon-label condition-apply-toggle"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon path={open ? mdiChevronDown : mdiChevronRight} /> Apply {name} to…
          </button>

          {open && (
            <>
              <ul className="apply-list">
                {ordered.map((c) => (
                  <li key={c.id}>
                    <label className="check">
                      <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} ariaLabel={c.name} />
                      {c.name}
                    </label>
                  </li>
                ))}
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

              {/* Cancel folds the form away rather than closing the sheet: the
                  rules text is still the reason this is open. */}
              <div className="modal-footer">
                <button type="button" className="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <span className="spacer" />
                <button type="button" className="primary" disabled={selected.size === 0} onClick={apply}>
                  Apply to {selected.size}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
