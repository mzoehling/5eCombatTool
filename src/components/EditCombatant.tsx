import { useState } from 'react'
import { battleStore } from '../store/battleStore'
import type { Combatant } from '../types'
import { Checkbox } from './Checkbox'
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
          <Checkbox
            checked={combatant.isPC}
            onChange={() => setFlag({ isPC: !combatant.isPC })}
            ariaLabel="Player character"
          />
          Player character
        </label>
        <label className="check">
          <Checkbox
            checked={combatant.hiddenFromPlayers}
            onChange={() => setFlag({ hiddenFromPlayers: !combatant.hiddenFromPlayers })}
            ariaLabel="Hidden from players"
          />
          Hidden from players
        </label>
        <label className="check">
          <Checkbox
            checked={combatant.isActive}
            onChange={() => setFlag({ isActive: !combatant.isActive })}
            ariaLabel="In battle"
          />
          In battle
        </label>
      </div>
      {/* Remove sits at the far end from Save: they are one mis-tap apart
          otherwise, and only one of them is reversible. */}
      <div className="modal-footer">
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
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ok" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  )
}
