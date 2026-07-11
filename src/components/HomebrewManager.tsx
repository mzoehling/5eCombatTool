import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import type { HomebrewEntry, HomebrewKind } from '../types'
import { HomebrewEditor } from './HomebrewEditor'
import { Modal } from './Modal'

export function HomebrewManager({ onClose }: { onClose: () => void }) {
  const entries = useLiveQuery(
    async () => (await db.homebrew.toArray()).sort((a, b) => a.statblock.name.localeCompare(b.statblock.name)),
    [],
    [],
  )
  const [editor, setEditor] = useState<{ kind: HomebrewKind; existing?: HomebrewEntry } | null>(null)

  const addToBattle = (entry: HomebrewEntry) => {
    const existing = battleStore.getState().combatants.map((c) => c.name)
    const [name] = suffixedNames(entry.statblock.name, 1, existing)
    battleStore.dispatch({
      type: 'addCombatant',
      combatant: combatantFromStatblock(entry.statblock, name, entry.kind === 'pc'),
    })
  }

  if (editor) {
    return <HomebrewEditor kind={editor.kind} existing={editor.existing} onClose={() => setEditor(null)} />
  }

  return (
    <Modal title="Homebrew & PCs" onClose={onClose}>
      <ul className="group-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" className="result-main" onClick={() => setEditor({ kind: entry.kind, existing: entry })}>
              <span className="result-name">
                {entry.statblock.name}
                <span className={`badge ${entry.kind === 'pc' ? 'pc' : 'hb'}`}>{entry.kind === 'pc' ? 'PC' : 'HB'}</span>
              </span>
              <span className="result-meta dim">
                AC {entry.statblock.ac} · HP {entry.statblock.hp.average}
                {entry.statblock.cr && ` · CR ${entry.statblock.cr}`}
              </span>
            </button>
            <button type="button" onClick={() => addToBattle(entry)}>＋ Battle</button>
            <button
              type="button"
              className="ghost"
              aria-label={`Delete ${entry.statblock.name}`}
              onClick={() => {
                if (confirm(`Delete "${entry.statblock.name}"?`)) db.homebrew.delete(entry.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="dim">No homebrew entries yet.</li>}
      </ul>
      <div className="modal-actions">
        <button type="button" onClick={() => setEditor({ kind: 'pc' })}>
          ＋ New PC
        </button>
        <button type="button" className="primary" onClick={() => setEditor({ kind: 'monster' })}>
          ＋ New monster
        </button>
      </div>
    </Modal>
  )
}
