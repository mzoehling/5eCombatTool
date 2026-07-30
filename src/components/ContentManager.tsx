import { mdiChevronDown, mdiChevronRight, mdiDelete, mdiPlus } from '@mdi/js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { deleteHomebrewEntry, homebrewAsShareablePack } from '../data/homebrewPack'
import { importPack, removePack } from '../data/packs'
import { db } from '../db'
import { suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import { HOMEBREW_PACK_ID, type ContentPack, type CreatureSection, type Statblock } from '../types'
import { HomebrewEditor } from './HomebrewEditor'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** A homebrew entry paired with the section it lives in — the section is what
 *  makes it a PC, so it has to travel with the statblock. */
interface HomebrewRow {
  section: CreatureSection
  statblock: Statblock
}

/** Flattens the Homebrew pack for the editor list: PCs first, each group by name. */
function homebrewRows(pack: ContentPack): HomebrewRow[] {
  const rows = (section: CreatureSection) =>
    (pack[section] ?? [])
      .map((statblock) => ({ section, statblock }))
      .sort((a, b) => a.statblock.name.localeCompare(b.statblock.name))
  return [...rows('pcs'), ...rows('monsters')]
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/** "3M / 1P / 12S" — the sections a pack actually carries. */
function packCounts(pack: ContentPack): string {
  return (
    [
      pack.monsters?.length && `${pack.monsters.length}M`,
      pack.pcs?.length && `${pack.pcs.length}P`,
      pack.spells?.length && `${pack.spells.length}S`,
      pack.items?.length && `${pack.items.length}I`,
    ]
      .filter(Boolean)
      .join(' / ') || 'empty'
  )
}

/**
 * One home for every source of content: the built-in Homebrew pack the user
 * authors here, and the packs they import. Homebrew and imported packs are the
 * same thing in storage, so managing them in two dialogs only made the split
 * look meaningful.
 */
export function ContentManager({ onClose }: { onClose: () => void }) {
  const packs = useLiveQuery(() => db.packs.toArray(), [], [])
  const [editor, setEditor] = useState<{ section: CreatureSection; existing?: Statblock } | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [homebrewOpen, setHomebrewOpen] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const homebrew = packs.find((p) => p.packId === HOMEBREW_PACK_ID)
  const imported = packs.filter((p) => p.packId !== HOMEBREW_PACK_ID)
  const rows = homebrew ? homebrewRows(homebrew) : []

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const pack = await importPack(await file.text())
      setMessage({ text: `Imported "${pack.name}" (${packCounts(pack)})` })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // The one source of truth for whether there is anything to share: the
  // function decides, and its result both enables the button and is the file.
  const shareable = homebrew && homebrewAsShareablePack(homebrew)

  const exportHomebrew = () => {
    if (!shareable) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(shareable)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${shareable.packId}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ text: `Exported "${shareable.name}" (${packCounts(shareable)}) — import it like any other pack.` })
  }

  const addToBattle = (row: HomebrewRow) => {
    const existing = battleStore.getState().combatants.map((c) => c.name)
    const [name] = suffixedNames(row.statblock.name, 1, existing)
    battleStore.dispatch({
      type: 'addCombatant',
      combatant: combatantFromStatblock(row.statblock, name, row.section === 'pcs'),
    })
  }

  // Swapped in place rather than stacked: two Modals means two backdrops, and a
  // click outside would close both.
  if (editor) {
    return <HomebrewEditor section={editor.section} existing={editor.existing} onClose={() => setEditor(null)} />
  }

  return (
    <Modal title="Content" className="modal-wide modal-tall modal-split" onClose={onClose}>
      {/* Fixed band: the actions and their outcome stay put while the list scrolls. */}
      <div className="modal-controls">
        <div className="modal-actions">
          <button type="button" className="primary icon-label" onClick={() => setEditor({ section: 'pcs' })}>
            <Icon path={mdiPlus} /> New PC
          </button>
          <button type="button" className="primary icon-label" onClick={() => setEditor({ section: 'monsters' })}>
            <Icon path={mdiPlus} /> New monster
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import pack…
          </button>
          {/* Nothing to share until something is authored — homebrewAsShareablePack
              returns undefined for an empty pack, which would not be importable. */}
          {shareable && (
            <button type="button" onClick={exportHomebrew}>
              Share homebrew…
            </button>
          )}
        </div>
        {message && <p className={message.error ? 'error-text' : 'ok-text'}>{message.text}</p>}
      </div>

      <div className="modal-scroll">
        <ul className="group-list">
          {/* Homebrew is pinned first: it is the one pack edited here, and the
              only one whose contents are worth listing inline. Collapsible so a
              large party does not bury the imported packs below it. */}
          <li>
            <button type="button" className="result-main" onClick={() => setHomebrewOpen(!homebrewOpen)}>
              <span className="result-name">
                <Icon path={homebrewOpen ? mdiChevronDown : mdiChevronRight} /> Homebrew
              </span>
              <span className="result-meta dim">
                {rows.length === 0
                  ? 'nothing yet'
                  : `${plural(homebrew?.monsters?.length ?? 0, 'monster')} · ${plural(homebrew?.pcs?.length ?? 0, 'PC')}`}
              </span>
            </button>
          </li>
          {homebrewOpen &&
            rows.map((row) => (
              <li key={row.statblock.id} className="nested">
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
          {homebrewOpen && rows.length === 0 && <li className="dim nested">No homebrew entries yet.</li>}

          {imported.map((pack) => (
            <li key={pack.packId}>
              <span className="dim-wrap">
                <b>{pack.name}</b>{' '}
                <span className="dim">
                  v{pack.version} · {packCounts(pack)}
                </span>
              </span>
              <button
                type="button"
                className="ghost"
                aria-label={`Remove pack ${pack.name}`}
                onClick={() => {
                  // Confirmed like every other destructive action here — losing a
                  // whole book to a mis-tap is worse than losing one homebrew entry.
                  if (confirm(`Remove "${pack.name}"? Its contents leave the compendium.`)) {
                    removePack(pack.packId)
                  }
                }}
              >
                <Icon path={mdiDelete} />
              </button>
            </li>
          ))}
          {imported.length === 0 && <li className="dim">No content packs imported.</li>}
        </ul>
      </div>
    </Modal>
  )
}
