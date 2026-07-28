import { mdiPlus } from '@mdi/js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { findMonsterByName } from '../data/compendium'
import { suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { StatblockPanel } from './StatblockPanel'

interface CreatureInfoProps {
  /** Creature name from a {@creature} reference. */
  name: string
  onClose: () => void
}

/**
 * Statblock preview for a referenced creature (summons, "calls two guards")
 * with a one-click add to the battle. The embedded StatblockPanel brings its
 * own dice/condition/spell/item/creature link handling.
 */
export function CreatureInfo({ name, onClose }: CreatureInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findMonsterByName(name)) ?? null, [name])
  const [notice, setNotice] = useState('')

  if (found === undefined) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">Loading…</p>
      </Modal>
    )
  }

  if (found === null) {
    return (
      <Modal title={name} onClose={onClose}>
        <p className="dim">This creature isn’t in the compendium (SRD + imported packs + homebrew).</p>
      </Modal>
    )
  }

  const { entry: statblock, origin, section } = found

  const addToBattle = () => {
    const existing = battleStore.getState().combatants.map((c) => c.name)
    const [uniqueName] = suffixedNames(statblock.name, 1, existing)
    // A link can resolve to a PC as easily as to a monster; the section says which.
    battleStore.dispatch({
      type: 'addCombatant',
      combatant: combatantFromStatblock(statblock, uniqueName, section === 'pcs'),
    })
    setNotice(`Added ${uniqueName}`)
    setTimeout(() => setNotice(''), 2000)
  }

  return (
    <Modal title={statblock.name} onClose={onClose}>
      <StatblockPanel
        combatant={combatantFromStatblock(statblock)}
        origin={origin}
        pinned={false}
        onTogglePin={() => {}}
      />
      <div className="modal-actions">
        <button type="button" className="primary icon-label" onClick={addToBattle}>
          <Icon path={mdiPlus} /> Add to battle
        </button>
      </div>
      {notice && <div className="toast">{notice}</div>}
    </Modal>
  )
}
