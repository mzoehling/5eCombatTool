import { mdiPlus } from '@mdi/js'
import { useState } from 'react'
import { derivedGroupName, nextGroupColor } from '../lib/groups'
import { newId } from '../lib/id'
import { battleStore, useBattleState } from '../store/battleStore'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface AssignGroupProps {
  /** The AoE selection being grouped. */
  ids: ReadonlySet<string>
  onClose: () => void
}

/** Only a fallback for groups stored before colours were assigned. */
const LEGACY_COLOR = '#e0a94a'

/**
 * Puts a selection into a group: an existing one, or a new one named here.
 *
 * The AoE bar used to create a group every time, which made the second press
 * the wrong thing — reinforcements joining the fight got a group of their own
 * instead of joining the goblins already on the tracker, and there was no way
 * to say otherwise. Picking the target is the whole feature, so it gets a
 * dialog rather than a button that guesses.
 */
export function AssignGroup({ ids, onClose }: AssignGroupProps) {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()
  const chosen = combatants.filter((c) => ids.has(c.id))
  const grouped = chosen.filter((c) => c.groupId).length
  const [name, setName] = useState(() => derivedGroupName(chosen.map((c) => c.name), battle.groups))
  const [color, setColor] = useState(() => nextGroupColor(battle.groups.length))

  const assign = (groupId: string | undefined) => {
    for (const c of chosen) dispatch({ type: 'assignGroup', combatantId: c.id, groupId })
    onClose()
  }

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = newId()
    dispatch({ type: 'addGroup', group: { id, name: trimmed, inBattle: true, color } })
    assign(id)
  }

  return (
    <Modal
      title={`Group ${chosen.length} ${chosen.length === 1 ? 'combatant' : 'combatants'}`}
      className="modal-split"
      onClose={onClose}
    >
      {/* The new group sits in the fixed band, above the existing ones: with no
          groups yet it is the only thing to do, and with several it is still
          the one that needs typing. */}
      <div className="modal-controls">
        <div className="inline-form">
          <input
            type="color"
            className="group-color"
            value={color}
            aria-label="Colour for the new group"
            onChange={(e) => setColor(e.target.value)}
          />
          <input
            placeholder="New group name"
            value={name}
            aria-label="New group name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button type="button" className="primary icon-label" disabled={!name.trim()} onClick={create}>
            <Icon path={mdiPlus} /> Create
          </button>
        </div>
      </div>

      <div className="modal-scroll">
        <ul className="group-list">
          {battle.groups.map((g) => {
            const members = combatants.filter((c) => c.groupId === g.id).length
            return (
              <li key={g.id}>
                <span className="group-swatch" style={{ background: g.color ?? LEGACY_COLOR }} />
                <span className="group-name">
                  {g.name} <span className="dim">({members} members)</span>
                </span>
                <button type="button" className="outlined" onClick={() => assign(g.id)}>
                  Move here
                </button>
              </li>
            )
          })}
          {battle.groups.length === 0 && <li className="dim">No groups yet — name one above.</li>}
        </ul>
      </div>

      <div className="modal-footer">
        {/* Ungrouping is the same act in reverse, so it lives here rather than
            costing the crowded AoE bar a second button. */}
        {grouped > 0 && (
          <button type="button" className="danger" onClick={() => assign(undefined)}>
            Remove from group
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
