import { useState } from 'react'
import { battleStore } from '../store/battleStore'
import type { Combatant } from '../types'
import { Modal } from './Modal'

interface EditCombatantProps {
  combatant: Combatant
  onClose: () => void
}

export function EditCombatant({ combatant, onClose }: EditCombatantProps) {
  const { dispatch, getState } = battleStore
  const groups = getState().battle.groups
  const [name, setName] = useState(combatant.name)
  const [maxHp, setMaxHp] = useState(String(combatant.maxHp))
  const [ac, setAc] = useState(String(combatant.armorClass))
  const [bonus, setBonus] = useState(String(combatant.initiativeBonus))

  const save = () => {
    dispatch({
      type: 'updateCombatant',
      id: combatant.id,
      patch: {
        name: name.trim() || combatant.name,
        maxHp: Number(maxHp) || combatant.maxHp,
        armorClass: Number(ac) || combatant.armorClass,
        initiativeBonus: Number(bonus) || 0,
      },
    })
    onClose()
  }

  const setFlag = (patch: Partial<Combatant>) => dispatch({ type: 'updateCombatant', id: combatant.id, patch })

  return (
    <Modal title={`Edit — ${combatant.name}`} onClose={onClose}>
      <div className="form-grid">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Max HP
          <input inputMode="numeric" value={maxHp} onChange={(e) => setMaxHp(e.target.value)} />
        </label>
        <label>
          AC
          <input inputMode="numeric" value={ac} onChange={(e) => setAc(e.target.value)} />
        </label>
        <label>
          Initiative bonus
          <input inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </label>
        <label>
          Group
          <select
            value={combatant.groupId ?? ''}
            onChange={(e) =>
              dispatch({ type: 'assignGroup', combatantId: combatant.id, groupId: e.target.value || undefined })
            }
          >
            <option value="">— none —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={combatant.isPC}
            onChange={(e) => setFlag({ isPC: e.target.checked })}
          />
          Player character
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={combatant.hiddenFromPlayers}
            onChange={(e) => setFlag({ hiddenFromPlayers: e.target.checked })}
          />
          Hidden from players
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={combatant.isActive}
            onChange={(e) => setFlag({ isActive: e.target.checked })}
          />
          In battle
        </label>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="danger"
          onClick={() => {
            dispatch({ type: 'removeCombatants', ids: [combatant.id] })
            onClose()
          }}
        >
          Remove
        </button>
        <button type="button" className="primary" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  )
}
