import { mdiContentSave, mdiDelete, mdiPlus, mdiSwapHorizontal, mdiTrashCanOutline } from '@mdi/js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { instantiateEncounter, prepareForAdd, saveEncounter } from '../data/encounters'
import { db } from '../db'
import { battleStore, useBattleState } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import { newId } from '../lib/id'
import { HOMEBREW_PACK_ID, type Group, type SavedEncounter } from '../types'
import { AcShield } from './AcShield'
import { Checkbox } from './Checkbox'
import { GroupRoster } from './GroupRoster'
import { HomebrewEditor } from './HomebrewEditor'
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
  // An encounter of only PCs is how a DM reuses their party every session, so
  // it gets a named path instead of hiding behind "save current".
  const [mode, setMode] = useState<'current' | 'party' | 'groups'>('current')
  const [partyName, setPartyName] = useState('')
  const [partyIds, setPartyIds] = useState<ReadonlySet<string>>(new Set())
  const [newPC, setNewPC] = useState(false)
  const pcs = useLiveQuery(
    async () =>
      ((await db.packs.get(HOMEBREW_PACK_ID))?.pcs ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [],
    [],
  )

  const togglePc = (id: string) => {
    const next = new Set(partyIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPartyIds(next)
  }

  const saveParty = async () => {
    const chosen = pcs.filter((p) => partyIds.has(p.id))
    if (!partyName.trim() || chosen.length === 0) return
    // A party is a normal encounter — no new data type. It carries its own
    // group so loading it gives back the named party rather than loose PCs.
    const group: Group = { id: newId(), name: partyName.trim(), inBattle: true }
    const entry = await saveEncounter(
      partyName,
      chosen.map((sb) => ({ ...combatantFromStatblock(sb, sb.name, true), groupId: group.id })),
      [group],
    )
    setMessage(`Saved party "${entry.name}" (${entry.combatants.length} PCs).`)
    setPartyName('')
    setPartyIds(new Set())
  }

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

  // Swapped in place rather than stacked: two Modals means two backdrops, and
  // a click outside would close both.
  if (newPC) {
    return <HomebrewEditor section="pcs" onClose={() => setNewPC(false)} />
  }

  return (
    <Modal title="Encounters" className="modal-split" onClose={onClose}>
      {/* Fixed band: the save form and its outcome stay put while the list scrolls. */}
      <div className="modal-controls">
        <div className="segments enc-modes">
          <button type="button" aria-pressed={mode === 'current'} onClick={() => setMode('current')}>
            Tracker
          </button>
          <button type="button" aria-pressed={mode === 'party'} onClick={() => setMode('party')}>
            Party
          </button>
          {/* The live groups belong here: a group is where a combatant came
              from, and that is what this dialog is about. */}
          <button type="button" aria-pressed={mode === 'groups'} onClick={() => setMode('groups')}>
            Groups
          </button>
        </div>

        {mode === 'groups' ? (
          <GroupRoster />
        ) : mode === 'party' ? (
          <>
            <div className="inline-form">
              <input
                placeholder="Party name (e.g. The Usual Suspects)"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveParty()}
              />
              <button
                type="button"
                className="ok icon-label"
                disabled={!partyName.trim() || partyIds.size === 0}
                onClick={saveParty}
              >
                <Icon path={mdiContentSave} /> Save party of {partyIds.size}
              </button>
            </div>
            <ul className="apply-list party-list">
              {pcs.map((pc) => (
                <li key={pc.id} className="party-row">
                  <label className="check">
                    <Checkbox
                      checked={partyIds.has(pc.id)}
                      onChange={() => togglePc(pc.id)}
                      ariaLabel={pc.name}
                    />
                    <AcShield value={pc.ac} />
                    <span className="party-name">
                      {pc.name}
                      <span className="result-meta dim">
                        HP {pc.hp.average} · Init {pc.initiativeBonus >= 0 ? '+' : ''}
                        {pc.initiativeBonus}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {pcs.length === 0 && (
                <li className="dim">No player characters in the Homebrew pack yet.</li>
              )}
            </ul>
            {/* Escape hatch: a party is only as good as the PCs behind it. */}
            <button type="button" className="ghost icon-label" onClick={() => setNewPC(true)}>
              <Icon path={mdiPlus} /> New PC in homebrew…
            </button>
          </>
        ) : (
        <div className="inline-form">
          <input
            placeholder="Name (e.g. Goblin Ambush, Party)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button
            type="button"
            className="ok icon-label"
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
        )}
        {message && <p className="ok-text">{message}</p>}
      </div>

      <div className="modal-scroll">
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
              {/* Load replaces, Add merges — the two must not read alike. */}
              <button
                type="button"
                className="outlined icon-label"
                title="Replace the tracker with this encounter"
                onClick={() => load(e)}
              >
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
      </div>
    </Modal>
  )
}
