import { mdiDelete } from '@mdi/js'
import { useState } from 'react'
import { newId } from '../lib/id'
import { battleStore, useBattleState } from '../store/battleStore'
import { Icon } from './Icon'

const DEFAULT_COLOR = '#e0a94a'

/**
 * The groups in the running battle: which are in the fight, what colour they
 * carry, and how many members they have.
 *
 * This is deliberately not its own dialog. A group is where a combatant came
 * from — encounters create theirs on load — so the roster lives as a tab of the
 * Encounters dialog, and creating a group happens where it is assigned, in the
 * edit-combatant form. What is left here is the group-level work: benching a
 * whole group mid-fight, recolouring it, deleting it.
 */
export function GroupRoster() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    dispatch({ type: 'addGroup', group: { id: newId(), name: trimmed, inBattle: true, color } })
    setName('')
  }

  return (
    <>
      <div className="inline-form">
        <input
          type="color"
          className="group-color"
          value={color}
          aria-label="Color for new group"
          onChange={(e) => setColor(e.target.value)}
        />
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

      <ul className="group-list">
        {battle.groups.map((g) => {
          const members = combatants.filter((c) => c.groupId === g.id).length
          return (
            <li key={g.id}>
              <input
                type="color"
                className="group-color"
                value={g.color ?? DEFAULT_COLOR}
                aria-label={`Color for group ${g.name}`}
                onChange={(e) => dispatch({ type: 'updateGroup', id: g.id, patch: { color: e.target.value } })}
              />
              {/* A group's "in battle" state is the one genuinely binary
                  setting in the app, so it is the one switch. It filters
                  turnOrder, which is why it cannot live inside a single
                  combatant's edit dialog. */}
              <label className="switch">
                <input
                  type="checkbox"
                  checked={g.inBattle}
                  aria-label={`${g.name} in battle`}
                  onChange={(e) => dispatch({ type: 'setGroupInBattle', id: g.id, inBattle: e.target.checked })}
                />
                <span className="switch-track" />
              </label>
              <span className="group-name">
                {g.name}{' '}
                <span className="dim">
                  ({members} members, {g.inBattle ? 'in battle' : 'out'})
                </span>
              </span>
              <button
                type="button"
                className="ghost"
                aria-label={`Delete group ${g.name}`}
                onClick={() => dispatch({ type: 'removeGroup', id: g.id })}
              >
                <Icon path={mdiDelete} />
              </button>
            </li>
          )
        })}
        {battle.groups.length === 0 && (
          <li className="dim">
            No groups yet. Loading an encounter creates one named after it, or put a combatant into a new group from
            its edit dialog.
          </li>
        )}
      </ul>
    </>
  )
}
