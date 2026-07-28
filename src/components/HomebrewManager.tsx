import { mdiDelete, mdiPlus } from '@mdi/js'
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportBackup, importBackup } from '../data/backup'
import { deleteHomebrewEntry, getHomebrewPack, type HomebrewSection } from '../data/homebrewPack'
import { suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import type { Statblock } from '../types'
import { HomebrewEditor } from './HomebrewEditor'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** A homebrew entry paired with the section it lives in. */
interface HomebrewRow {
  section: HomebrewSection
  statblock: Statblock
}

export function HomebrewManager({ onClose }: { onClose: () => void }) {
  const entries = useLiveQuery(
    async (): Promise<HomebrewRow[]> => {
      const pack = await getHomebrewPack()
      return [
        ...(pack.pcs ?? []).map((statblock) => ({ section: 'pcs' as const, statblock })),
        ...(pack.monsters ?? []).map((statblock) => ({ section: 'monsters' as const, statblock })),
      ].sort((a, b) => a.statblock.name.localeCompare(b.statblock.name))
    },
    [],
    [],
  )
  const [editor, setEditor] = useState<{ section: HomebrewSection; existing?: Statblock } | null>(null)
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
      const summary = await importBackup(await file.text())
      if (summary.battleRestored) await battleStore.hydrate()
      const parts = [`${summary.homebrew} homebrew entries`]
      if (summary.packs) parts.push(`${summary.packs} packs`)
      if (summary.encounters) parts.push(`${summary.encounters} encounters`)
      if (summary.battleRestored) parts.push('the saved battle')
      setMessage({ text: `Imported ${parts.join(', ')}.` })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const addToBattle = (row: HomebrewRow) => {
    const existing = battleStore.getState().combatants.map((c) => c.name)
    const [name] = suffixedNames(row.statblock.name, 1, existing)
    battleStore.dispatch({
      type: 'addCombatant',
      combatant: combatantFromStatblock(row.statblock, name, row.section === 'pcs'),
    })
  }

  if (editor) {
    return <HomebrewEditor section={editor.section} existing={editor.existing} onClose={() => setEditor(null)} />
  }

  return (
    <Modal title="Homebrew & PCs" className="modal-split" onClose={onClose}>
      {/* Fixed band: the actions and their outcome stay put while the list scrolls. */}
      <div className="modal-controls">
        <div className="modal-actions">
          <button type="button" className="primary icon-label" onClick={() => setEditor({ section: 'pcs' })}>
            <Icon path={mdiPlus} /> New PC
          </button>
          <button type="button" className="primary icon-label" onClick={() => setEditor({ section: 'monsters' })}>
            <Icon path={mdiPlus} /> New monster
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
          <button type="button" onClick={doExport}>
            Export backup
          </button>
        </div>
        {message && <p className={message.error ? 'error-text' : 'ok-text'}>{message.text}</p>}
      </div>

      <div className="modal-scroll">
        <ul className="group-list">
          {entries.map((row) => (
            <li key={row.statblock.id}>
              <button
                type="button"
                className="result-main"
                onClick={() => setEditor({ section: row.section, existing: row.statblock })}
              >
                <span className="result-name">
                  {row.statblock.name}
                  <span className={`badge ${row.section === 'pcs' ? 'pc' : 'hb'}`}>
                    {row.section === 'pcs' ? 'PC' : 'HB'}
                  </span>
                </span>
                <span className="result-meta dim">
                  AC {row.statblock.ac} · HP {row.statblock.hp.average}
                  {row.statblock.cr && ` · CR ${row.statblock.cr}`}
                </span>
              </button>
              <button type="button" className="icon-label" onClick={() => addToBattle(row)}>
                <Icon path={mdiPlus} /> Battle
              </button>
              <button
                type="button"
                className="ghost"
                aria-label={`Delete ${row.statblock.name}`}
                onClick={() => {
                  if (confirm(`Delete "${row.statblock.name}"?`)) {
                    deleteHomebrewEntry(row.section, row.statblock.id)
                  }
                }}
              >
                <Icon path={mdiDelete} />
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="dim">No homebrew entries yet.</li>}
        </ul>
      </div>
    </Modal>
  )
}
