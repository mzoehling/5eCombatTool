import { battleStore } from '../store/battleStore'
import { CONDITIONS, type Combatant, type ConditionName } from '../types'
import { Modal } from './Modal'

interface ConditionEditorProps {
  combatant: Combatant
  onClose: () => void
}

export function ConditionEditor({ combatant, onClose }: ConditionEditorProps) {
  const { dispatch } = battleStore
  const active = new Map(combatant.conditions.map((c) => [c.condition, c]))

  const toggle = (condition: ConditionName) => {
    if (active.has(condition)) dispatch({ type: 'removeCondition', id: combatant.id, condition })
    else
      dispatch({
        type: 'setCondition',
        id: combatant.id,
        condition: { condition, level: condition === 'Exhaustion' ? 1 : undefined },
      })
  }

  const adjustRounds = (condition: ConditionName, delta: number) => {
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

  return (
    <Modal title={`Conditions — ${combatant.name}`} onClose={onClose}>
      <ul className="condition-list">
        {CONDITIONS.map((condition) => {
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
        })}
      </ul>
    </Modal>
  )
}
