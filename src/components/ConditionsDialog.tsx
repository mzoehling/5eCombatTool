import { useState } from 'react'
import { conditionInstance, conditionSpread, customConditions } from '../lib/conditions'
import { battleStore } from '../store/battleStore'
import { CONDITIONS, SPELL_EFFECTS, type Combatant } from '../types'
import { Modal } from './Modal'

interface ConditionsDialogProps {
  /** Who the dialog acts on: one row, or an AoE selection. */
  targets: readonly Combatant[]
  onClose: () => void
}

/**
 * Setting conditions — on one combatant or on a whole selection.
 *
 * These were two components for one job whose only difference was the number of
 * targets, and a third that welded the rules text to the multi-target form (now
 * `ConditionInfo`, a plain reader).
 *
 * The two target counts keep **different write models**, deliberately:
 *
 * - **One target** writes immediately, one dispatch per tap, with live steppers
 *   for duration and exhaustion level. Mid-combat there is nothing to confirm —
 *   the row behind the dialog already shows the result.
 * - **Several targets** stage a choice and commit it with "Apply to N", as one
 *   undoable step. Applying to five combatants on every tap of a list would make
 *   an exploratory tap expensive, and there is no single row to read the result
 *   off.
 */
export function ConditionsDialog({ targets, onClose }: ConditionsDialogProps) {
  const { dispatch } = battleStore
  const single = targets.length === 1 ? targets[0] : null
  const [custom, setCustom] = useState('')
  // Multi-target only: the condition being staged, and its form values.
  const [staged, setStaged] = useState<string | null>(null)
  const [rounds, setRounds] = useState('')
  const [level, setLevel] = useState('1')

  const activeOnSingle = new Map((single?.conditions ?? []).map((c) => [c.condition, c]))

  // ---- single target: immediate writes -------------------------------------

  const toggleSingle = (condition: string) => {
    if (!single) return
    if (activeOnSingle.has(condition)) dispatch({ type: 'removeCondition', id: single.id, condition })
    else
      dispatch({
        type: 'setCondition',
        id: single.id,
        condition: { condition, level: condition === 'Exhaustion' ? 1 : undefined },
      })
  }

  const adjustRounds = (condition: string, delta: number) => {
    const current = activeOnSingle.get(condition)
    if (!single || !current) return
    const next = Math.max(0, (current.remainingRounds ?? 0) + delta)
    dispatch({
      type: 'setCondition',
      id: single.id,
      condition: { ...current, remainingRounds: next === 0 ? undefined : next },
    })
  }

  const adjustLevel = (delta: number) => {
    const current = activeOnSingle.get('Exhaustion')
    if (!single || !current) return
    dispatch({
      type: 'setCondition',
      id: single.id,
      condition: { ...current, level: Math.min(6, Math.max(1, (current.level ?? 1) + delta)) },
    })
  }

  const addCustom = () => {
    const name = custom.trim()
    if (!name) return
    if (single) {
      if (activeOnSingle.has(name)) return
      dispatch({ type: 'setCondition', id: single.id, condition: { condition: name } })
    } else {
      setStaged(name)
    }
    setCustom('')
  }

  // ---- several targets: staged, committed as one step ----------------------

  const applyToAll = () => {
    if (!staged) return
    const condition = conditionInstance(staged, rounds, level)
    // One gesture, one undo — see battleStore.dispatchAll.
    battleStore.dispatchAll(targets.map((t) => ({ type: 'setCondition' as const, id: t.id, condition })))
    onClose()
  }

  const removeFromAll = () => {
    if (!staged) return
    battleStore.dispatchAll(
      targets
        .filter((t) => t.conditions.some((c) => c.condition === staged))
        .map((t) => ({ type: 'removeCondition' as const, id: t.id, condition: staged })),
    )
    onClose()
  }

  const renderRow = (condition: string) => {
    const instance = activeOnSingle.get(condition)
    const spread = single ? null : conditionSpread(targets, condition)
    const on = single ? instance !== undefined : staged === condition
    return (
      <li key={condition} className={on ? 'on' : ''}>
        <button
          type="button"
          className="condition-toggle"
          aria-pressed={on}
          onClick={() => (single ? toggleSingle(condition) : setStaged(condition))}
        >
          {condition}
          {instance && condition === 'Exhaustion' && ` ${instance.level ?? 1}`}
          {/* Several targets rarely agree, so the list says how many already
              have it rather than pretending the answer is on or off. */}
          {spread && spread.on > 0 && (
            <span className="dim condition-count">
              on {spread.on} of {spread.total}
            </span>
          )}
        </button>

        {/* Exhaustion is tracked by level, not by rounds — it does not tick down
            on its own — so it gets a 1–6 stepper in place of the duration one. */}
        {single && instance && condition === 'Exhaustion' && (
          <span className="stepper">
            <button type="button" aria-label="Lower exhaustion level" onClick={() => adjustLevel(-1)}>
              −
            </button>
            <span className="rounds-label">Lvl {instance.level ?? 1}</span>
            <button type="button" aria-label="Raise exhaustion level" onClick={() => adjustLevel(1)}>
              +
            </button>
          </span>
        )}
        {single && instance && condition !== 'Exhaustion' && (
          <span className="stepper rounds">
            <button type="button" aria-label={`Shorten ${condition}`} onClick={() => adjustRounds(condition, -1)}>
              −
            </button>
            <span className="rounds-label">
              {instance.remainingRounds === undefined ? '∞' : `${instance.remainingRounds} rd`}
            </span>
            <button type="button" aria-label={`Lengthen ${condition}`} onClick={() => adjustRounds(condition, 1)}>
              +
            </button>
          </span>
        )}
      </li>
    )
  }

  const customNames = single ? customConditions([single]) : customConditions(targets)
  const stagedSpread = staged ? conditionSpread(targets, staged) : null

  return (
    <Modal
      title={single ? `Conditions — ${single.name}` : `Conditions — ${targets.length} selected`}
      onClose={onClose}
    >
      {/* Who this will hit. With one target the dialog title already says it; with
          several, the band is the only place the selection is visible once the
          dialog covers the rows. */}
      {!single && (
        <p className="condition-targets">
          {targets.map((t) => (
            <span key={t.id} className="chip custom">
              {t.name}
            </span>
          ))}
          {targets.length === 0 && <span className="dim">Nothing selected.</span>}
        </p>
      )}

      <ul className="condition-list">{CONDITIONS.map(renderRow)}</ul>

      <h3 className="condition-heading">Spell effects</h3>
      <ul className="condition-list">{SPELL_EFFECTS.map(renderRow)}</ul>

      {customNames.length > 0 && (
        <>
          <h3 className="condition-heading">Custom effects</h3>
          <ul className="condition-list">{customNames.map(renderRow)}</ul>
        </>
      )}

      <div className="inline-form">
        <input
          placeholder="Custom effect (e.g. Marked by Ranger)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
        />
        <button type="button" className="primary" disabled={!custom.trim()} onClick={addCustom}>
          Add
        </button>
      </div>

      {/* Duration and level are staged fields only in the multi-target case; with
          one target the same values are live steppers on the row itself. */}
      {!single && staged && (
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
          {staged === 'Exhaustion' && (
            <label>
              Level (1–6)
              <input inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
            </label>
          )}
        </div>
      )}

      {/* No footer with one target: it writes as you tap, so there is nothing to
          confirm and a Cancel button would be a lie. */}
      {!single && (
        <div className="modal-footer">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <span className="spacer" />
          {/* Ending an area effect on everyone it caught is the other half of
              applying one, and only offered when there is something to end. */}
          {stagedSpread && stagedSpread.on > 0 && (
            <button type="button" onClick={removeFromAll}>
              Remove from {stagedSpread.on}
            </button>
          )}
          <button type="button" className="primary" disabled={!staged || targets.length === 0} onClick={applyToAll}>
            Apply to {targets.length}
          </button>
        </div>
      )}
    </Modal>
  )
}
