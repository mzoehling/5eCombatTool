import { mdiContentSave, mdiDelete, mdiPlus, mdiSwapHorizontal, mdiTrashCanOutline } from '@mdi/js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { instantiateEncounter, prepareForAdd, saveEncounter } from '../data/encounters'
import { db } from '../db'
import { battleStore, useBattleState } from '../store/battleStore'
import type { SavedEncounter } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** Save the current tracker as a named encounter; load or merge saved ones. */
export function EncountersManager({ onClose }: { onClose: () => void }) {
  const { dispatch } = battleStore
  const state = useBattleState()
  const encounters = useLiveQuery(
    async () => (await db.encounters.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
    [],
  )
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const save = async () => {
    if (!name.trim() || state.combatants.length === 0) return
    const entry = await saveEncounter(name, state.combatants, state.battle.groups)
    setMessage(`Saved "${entry.name}" (${entry.combatants.length} combatants).`)
    setName('')
  }

  const load = (saved: SavedEncounter) => {
    if (
      state.combatants.length > 0 &&
      !confirm(`Replace the current tracker with "${saved.name}"? (Undo can bring it back.)`)
    ) {
      return
    }
    const { combatants, groups } = instantiateEncounter(saved)
    dispatch({ type: 'loadEncounter', name: saved.name, combatants, groups, mode: 'replace' })
    setMessage(`Loaded "${saved.name}".`)
  }

  const add = (saved: SavedEncounter) => {
    const instance = instantiateEncounter(saved)
    const existingNames = state.combatants.map((c) => c.name)
    const { combatants, skippedPCs } = prepareForAdd(instance.combatants, existingNames)
    if (!combatants.length) {
      setMessage(skippedPCs ? 'All of these PCs are already in the tracker.' : 'Nothing to add.')
      return
    }
    dispatch({ type: 'loadEncounter', name: saved.name, combatants, groups: instance.groups, mode: 'add' })
    setMessage(
      `Added ${combatants.length} from "${saved.name}"${skippedPCs ? ` (${skippedPCs} PCs already present)` : ''}.`,
    )
  }

  const remove = (saved: SavedEncounter) => {
    if (confirm(`Delete saved encounter "${saved.name}"?`)) db.encounters.delete(saved.id)
  }

  const clear = () => {
    if (state.combatants.length === 0) return
    if (!confirm('Clear the current tracker? This removes all combatants and the combat log. (Undo can bring it back.)')) {
      return
    }
    dispatch({ type: 'loadEncounter', name: '', combatants: [], groups: [], mode: 'replace' })
    battleStore.clearLog()
    setMessage('Cleared the tracker.')
  }

  return (
    <Modal title="Encounters" onClose={onClose}>
      <div className="inline-form">
        <input
          placeholder="Name (e.g. Goblin Ambush, Party)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button
          type="button"
          className="primary icon-label"
          disabled={!name.trim() || state.combatants.length === 0}
          title="Save the current tracker under this name"
          onClick={save}
        >
          <Icon path={mdiContentSave} /> Save current
        </button>
        <button
          type="button"
          className="danger icon-label"
          disabled={state.combatants.length === 0}
          title="Remove all combatants and the combat log from the tracker"
          onClick={clear}
        >
          <Icon path={mdiTrashCanOutline} /> Clear
        </button>
      </div>

      <ul className="group-list">
        {encounters.map((e) => (
          <li key={e.id}>
            <span className="result-main">
              <span className="result-name">{e.name}</span>
              <span className="result-meta dim">
                {e.combatants.length} combatants
                {e.combatants.some((c) => c.isPC) && ` (${e.combatants.filter((c) => c.isPC).length} PCs)`} ·{' '}
                {new Date(e.updatedAt).toLocaleDateString()}
              </span>
            </span>
            <button type="button" className="icon-label" title="Replace the tracker with this encounter" onClick={() => load(e)}>
              <Icon path={mdiSwapHorizontal} /> Load
            </button>
            <button type="button" className="icon-label" title="Merge into the current tracker" onClick={() => add(e)}>
              <Icon path={mdiPlus} /> Add
            </button>
            <button type="button" className="ghost" aria-label={`Delete ${e.name}`} onClick={() => remove(e)}>
              <Icon path={mdiDelete} />
            </button>
          </li>
        ))}
        {encounters.length === 0 && (
          <li className="dim">
            No saved encounters yet. Build a fight (or just your party) in the tracker, then save it here for later.
          </li>
        )}
      </ul>

      {message && <p className="ok-text">{message}</p>}
    </Modal>
  )
}
