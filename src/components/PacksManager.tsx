import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { importPack, removePack } from '../data/packs'
import { Modal } from './Modal'

export function PacksManager({ onClose }: { onClose: () => void }) {
  const packs = useLiveQuery(() => db.packs.toArray(), [], [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const pack = await importPack(await file.text())
      const counts = [
        pack.monsters?.length && `${pack.monsters.length} monsters`,
        pack.spells?.length && `${pack.spells.length} spells`,
        pack.items?.length && `${pack.items.length} items`,
      ]
        .filter(Boolean)
        .join(', ')
      setNotice(`Imported "${pack.name}" (${counts})`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Modal title="Content packs" onClose={onClose}>
      <ul className="group-list">
        {packs.map((pack) => (
          <li key={pack.packId}>
            <span className="dim-wrap">
              <b>{pack.name}</b>{' '}
              <span className="dim">
                v{pack.version} · {pack.monsters?.length ?? 0}M / {pack.spells?.length ?? 0}S /{' '}
                {pack.items?.length ?? 0}I
              </span>
            </span>
            <button
              type="button"
              className="ghost"
              aria-label={`Remove pack ${pack.name}`}
              onClick={() => removePack(pack.packId)}
            >
              ✕
            </button>
          </li>
        ))}
        {packs.length === 0 && <li className="dim">No content packs imported.</li>}
      </ul>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="ok-text">{notice}</p>}

      <div className="modal-actions">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
          Import pack (JSON)…
        </button>
      </div>
    </Modal>
  )
}
