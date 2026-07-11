import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportBackup, importBackup } from '../data/backup'
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
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    const json = await exportBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `5eCombatTool-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ text: 'Backup exported.' })
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const count = await importBackup(await file.text())
      setMessage({ text: `Imported ${count} homebrew entries.` })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

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
      {message && <p className={message.error ? 'error-text' : 'ok-text'}>{message.text}</p>}

      <div className="modal-actions">
        <button type="button" onClick={() => setEditor({ kind: 'pc' })}>
          ＋ New PC
        </button>
        <button type="button" className="primary" onClick={() => setEditor({ kind: 'monster' })}>
          ＋ New monster
        </button>
      </div>
      <div className="modal-actions">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => doImport(e.target.files?.[0])}
        />
        <button type="button" onClick={() => fileRef.current?.click()}>
          Import backup…
        </button>
        <button type="button" disabled={entries.length === 0} onClick={doExport}>
          Export backup
        </button>
      </div>
    </Modal>
  )
}
