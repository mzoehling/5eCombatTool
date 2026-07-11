import { useState } from 'react'
import { newId } from '../lib/id'
import { battleStore, useBattleState } from '../store/battleStore'
import { Modal } from './Modal'

export function GroupsEditor({ onClose }: { onClose: () => void }) {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()
  const [name, setName] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    dispatch({ type: 'addGroup', group: { id: newId(), name: trimmed, inBattle: true } })
    setName('')
  }

  return (
    <Modal title="Groups" onClose={onClose}>
      <ul className="group-list">
        {battle.groups.map((g) => {
          const members = combatants.filter((c) => c.groupId === g.id).length
          return (
            <li key={g.id}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={g.inBattle}
                  onChange={(e) => dispatch({ type: 'setGroupInBattle', id: g.id, inBattle: e.target.checked })}
                />
                {g.name} <span className="dim">({members} members, {g.inBattle ? 'in battle' : 'out'})</span>
              </label>
              <button type="button" className="ghost" aria-label={`Delete group ${g.name}`} onClick={() => dispatch({ type: 'removeGroup', id: g.id })}>
                ✕
              </button>
            </li>
          )
        })}
        {battle.groups.length === 0 && <li className="dim">No groups yet.</li>}
      </ul>
      <div className="inline-form">
        <input
          placeholder="New group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className="primary" onClick={add}>
          Add
        </button>
      </div>
    </Modal>
  )
}
