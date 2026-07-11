import { useState } from 'react'
import { battleStore } from '../store/battleStore'
import { CONDITIONS, SPELL_EFFECTS, type Combatant } from '../types'
import { Modal } from './Modal'

interface ConditionEditorProps {
  combatant: Combatant
  onClose: () => void
}

export function ConditionEditor({ combatant, onClose }: ConditionEditorProps) {
  const { dispatch } = battleStore
  const [custom, setCustom] = useState('')
  const active = new Map(combatant.conditions.map((c) => [c.condition, c]))

  // spell effects and custom entries flow through the same condition system
  const knownNames = new Set<string>([...CONDITIONS, ...SPELL_EFFECTS])
  const customActive = combatant.conditions.filter((c) => !knownNames.has(c.condition))

  const toggle = (condition: string) => {
    if (active.has(condition)) dispatch({ type: 'removeCondition', id: combatant.id, condition })
    else
      dispatch({
        type: 'setCondition',
        id: combatant.id,
        condition: { condition, level: condition === 'Exhaustion' ? 1 : undefined },
      })
  }

  const addCustom = () => {
    const name = custom.trim()
    if (!name || active.has(name)) return
    dispatch({ type: 'setCondition', id: combatant.id, condition: { condition: name } })
    setCustom('')
  }

  const adjustRounds = (condition: string, delta: number) => {
    const current = active.get(condition)
    if (!current) return
    const rounds = Math.max(0, (current.remainingRounds ?? 0) + delta)
    dispatch({
      type: 'setCondition',
      id: combatant.id,
      condition: { ...current, remainingRounds: rounds === 0 ? undefined : rounds },
    })
  }

  const adjustLevel = (delta: number) => {
    const current = active.get('Exhaustion')
    if (!current) return
    const level = Math.min(6, Math.max(1, (current.level ?? 1) + delta))
    dispatch({ type: 'setCondition', id: combatant.id, condition: { ...current, level } })
  }

  const renderRow = (condition: string) => {
    const instance = active.get(condition)
    return (
      <li key={condition} className={instance ? 'on' : ''}>
        <button type="button" className="condition-toggle" onClick={() => toggle(condition)}>
          {condition}
          {instance && condition === 'Exhaustion' && ` ${instance.level ?? 1}`}
        </button>
        {instance && condition === 'Exhaustion' && (
          <span className="stepper">
            <button type="button" onClick={() => adjustLevel(-1)}>−</button>
            <button type="button" onClick={() => adjustLevel(1)}>+</button>
          </span>
        )}
        {instance && (
          <span className="stepper rounds">
            <button type="button" onClick={() => adjustRounds(condition, -1)}>−</button>
            <span className="rounds-label">
              {instance.remainingRounds === undefined ? '∞' : `${instance.remainingRounds} rd`}
            </span>
            <button type="button" onClick={() => adjustRounds(condition, 1)}>+</button>
          </span>
        )}
      </li>
    )
  }

  return (
    <Modal title={`Conditions — ${combatant.name}`} onClose={onClose}>
      <ul className="condition-list">{CONDITIONS.map(renderRow)}</ul>

      <h3 className="condition-heading">Spell effects</h3>
      <ul className="condition-list">{SPELL_EFFECTS.map(renderRow)}</ul>

      {customActive.length > 0 && (
        <>
          <h3 className="condition-heading">Custom effects</h3>
          <ul className="condition-list">{customActive.map((c) => renderRow(c.condition))}</ul>
        </>
      )}

      <div className="inline-form">
        <input
          placeholder="Custom effect (e.g. Marked by Ranger)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
        />
        <button type="button" className="primary" onClick={addCustom}>
          Add
        </button>
      </div>
    </Modal>
  )
}
