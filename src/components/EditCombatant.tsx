import { useState } from 'react'
import { newId } from '../lib/id'
import { battleStore, useBattleState } from '../store/battleStore'
import type { Combatant } from '../types'
import { Checkbox } from './Checkbox'
import { Modal } from './Modal'

interface EditCombatantProps {
  combatant: Combatant
  onClose: () => void
}

const DEFAULT_GROUP_COLOR = '#e0a94a'

/** Sentinel option that opens the inline "new group" row. */
const NEW_GROUP = '__new__'

export function EditCombatant({ combatant, onClose }: EditCombatantProps) {
  const { dispatch } = battleStore
  // Subscribed rather than a snapshot: a group created below has to appear in
  // the dropdown straight away.
  const groups = useBattleState().battle.groups
  const [name, setName] = useState(combatant.name)
  const [maxHp, setMaxHp] = useState(String(combatant.maxHp))
  const [ac, setAc] = useState(String(combatant.armorClass))
  const [bonus, setBonus] = useState(String(combatant.initiativeBonus))
  const [newGroup, setNewGroup] = useState<{ name: string; color: string } | null>(null)

  // Creating and assigning in one step. Splitting them across two dialogs was
  // the whole reason the groups feature felt like more work than it was worth.
  const createGroup = () => {
    const trimmed = newGroup?.name.trim()
    if (!trimmed) return
    const id = newId()
    dispatch({ type: 'addGroup', group: { id, name: trimmed, inBattle: true, color: newGroup?.color } })
    dispatch({ type: 'assignGroup', combatantId: combatant.id, groupId: id })
    setNewGroup(null)
  }

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
            onChange={(e) => {
              if (e.target.value === NEW_GROUP) {
                setNewGroup({ name: '', color: DEFAULT_GROUP_COLOR })
                return
              }
              setNewGroup(null)
              dispatch({ type: 'assignGroup', combatantId: combatant.id, groupId: e.target.value || undefined })
            }}
          >
            <option value="">— none —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value={NEW_GROUP}>+ New group…</option>
          </select>
        </label>
        {newGroup && (
          <div className="new-group-row">
            <input
              type="color"
              className="group-color"
              value={newGroup.color}
              aria-label="Color for the new group"
              onChange={(e) => setNewGroup({ ...newGroup, color: e.target.value })}
            />
            <input
              autoFocus
              placeholder="Group name (e.g. Reinforcements)"
              value={newGroup.name}
              aria-label="New group name"
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createGroup()
                if (e.key === 'Escape') setNewGroup(null)
              }}
            />
            <button type="button" className="primary" disabled={!newGroup.name.trim()} onClick={createGroup}>
              Create
            </button>
            <button type="button" className="ghost" onClick={() => setNewGroup(null)}>
              Cancel
            </button>
          </div>
        )}
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
