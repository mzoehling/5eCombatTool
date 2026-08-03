import { mdiPlus } from '@mdi/js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { findMonsterByName } from '../data/compendium'
import { suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import type { ReferenceView } from '../lib/referenceStack'
import { Icon } from './Icon'
import { StatblockPanel } from './StatblockPanel'

interface CreatureInfoProps {
  /** Creature name from a {@creature} reference. */
  name: string
  /** Hands a rolled total to the AoE bar; threaded to the embedded statblock. */
  onSendRollToAoe?: (amount: number) => void
  /** Follows a reference out of the embedded statblock's text. Without it the
   *  links inside a referenced creature would be a dead end. */
  onOpenReference?: (view: ReferenceView) => void
}

/**
 * Statblock preview for a referenced creature (summons, "calls two guards")
 * with a one-click add to the battle. The embedded StatblockPanel brings its own
 * dice/condition/spell/item/creature link handling.
 *
 * A body in the reference drawer's stack — the drawer owns the shell and the
 * `‹` way back.
 */
export function CreatureInfo({ name, onSendRollToAoe, onOpenReference }: CreatureInfoProps) {
  // null = looked up and missing; undefined = query still pending
  const found = useLiveQuery(async () => (await findMonsterByName(name)) ?? null, [name])
  const [notice, setNotice] = useState('')

  if (found === undefined) return <p className="dim">Loading…</p>
  if (found === null) {
    return <p className="dim">This creature isn’t in the compendium (SRD + imported packs + homebrew).</p>
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
    <>
      {/* "Add to battle" comes first here rather than in a pinned footer: the
          drawer scrolls as one body, and it is the reason the sheet was opened. */}
      <div className="creature-add">
        <button type="button" className="primary icon-label" onClick={addToBattle}>
          <Icon path={mdiPlus} /> Add to battle
        </button>
      </div>
      <StatblockPanel
        combatant={combatantFromStatblock(statblock)}
        origin={origin}
        pinned={false}
        onTogglePin={() => {}}
        onSendRollToAoe={onSendRollToAoe}
        onOpenReference={onOpenReference}
      />
      {notice && <div className="toast">{notice}</div>}
    </>
  )
}
