import { mdiArrowLeft } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useCompendium, type CompendiumEntry, type Origin } from '../data/compendium'
import { rankByName, stripPostfix, suffixedNames } from '../lib/search'
import { renderTags } from '../lib/tagRenderer'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import type { Statblock } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { StatblockPanel } from './StatblockPanel'

type Tab = 'monsters' | 'spells' | 'items'

const CR_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'Any CR', min: -1, max: 99 },
  { label: 'CR 0–1', min: 0, max: 1 },
  { label: 'CR 2–4', min: 2, max: 4 },
  { label: 'CR 5–10', min: 5, max: 10 },
  { label: 'CR 11–16', min: 11, max: 16 },
  { label: 'CR 17+', min: 17, max: 99 },
]

function OriginBadge({ origin }: { origin: Origin }) {
  if (origin.kind === 'homebrew') return <span className="badge hb">{origin.isPC ? 'PC' : 'HB'}</span>
  if (origin.kind === 'pack') return <span className="badge pack">{origin.packName}</span>
  return null
}

export function Compendium({ onClose, initialQuery = '' }: { onClose: () => void; initialQuery?: string }) {
  const data = useCompendium()
  const [tab, setTab] = useState<Tab>('monsters')
  const [query, setQuery] = useState(stripPostfix(initialQuery))
  const [crBucket, setCrBucket] = useState(0)
  const [level, setLevel] = useState(-1)
  const [school, setSchool] = useState('')
  const [itemType, setItemType] = useState('')
  const [rarity, setRarity] = useState('')
  const [preview, setPreview] = useState<Statblock | null>(null)
  const [notice, setNotice] = useState('')

  const monsters = useMemo(() => {
    if (!data) return []
    const bucket = CR_BUCKETS[crBucket]
    const filtered = data.monsters.filter(({ entry }) => {
      if (crBucket === 0) return true
      const cr = entry.crNumeric ?? -1
      return cr >= bucket.min && cr <= bucket.max
    })
    return rankByName(filtered, query, (m) => m.entry.name).slice(0, 100)
  }, [data, query, crBucket])

  const spells = useMemo(() => {
    if (!data) return []
    const filtered = data.spells.filter(
      ({ entry }) => (level === -1 || entry.level === level) && (!school || entry.school === school),
    )
    return rankByName(filtered, query, (s) => s.entry.name).slice(0, 100)
  }, [data, query, level, school])

  const items = useMemo(() => {
    if (!data) return []
    const filtered = data.items.filter(
      ({ entry }) =>
        (!itemType || entry.typeName === itemType) && (!rarity || (entry.rarity ?? 'mundane') === rarity),
    )
    return rankByName(filtered, query, (i) => i.entry.name).slice(0, 100)
  }, [data, query, itemType, rarity])

  const schools = useMemo(() => [...new Set(data?.spells.map((s) => s.entry.school) ?? [])].sort(), [data])
  const itemTypes = useMemo(() => [...new Set(data?.items.map((i) => i.entry.typeName) ?? [])].sort(), [data])
  const rarities = useMemo(
    () => [...new Set(data?.items.map((i) => i.entry.rarity ?? 'mundane') ?? [])].sort(),
    [data],
  )

  const addMonster = (sb: Statblock, count: number, isPC: boolean) => {
    const existing = battleStore.getState().combatants.map((c) => c.name)
    for (const name of suffixedNames(sb.name, count, existing)) {
      battleStore.dispatch({ type: 'addCombatant', combatant: combatantFromStatblock(sb, name, isPC) })
      existing.push(name)
    }
    setNotice(`Added ${count}× ${sb.name}`)
    setTimeout(() => setNotice(''), 2000)
  }

  if (preview) {
    return (
      <Modal title={preview.name} onClose={() => setPreview(null)}>
        <StatblockPanel combatant={combatantFromStatblock(preview)} pinned={false} onTogglePin={() => {}} />
        <div className="modal-actions">
          <button type="button" className="ghost icon-label" onClick={() => setPreview(null)}>
            <Icon path={mdiArrowLeft} /> Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              addMonster(preview, 1, false)
              setPreview(null)
            }}
          >
            Add to battle
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Compendium" onClose={onClose}>
      <div className="sb-tabs">
        {(['monsters', 'spells', 'items'] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? 'primary' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="compendium-filters">
        <input
          type="search"
          placeholder="Search…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === 'monsters' && (
          <select value={crBucket} onChange={(e) => setCrBucket(Number(e.target.value))}>
            {CR_BUCKETS.map((b, i) => (
              <option key={b.label} value={i}>
                {b.label}
              </option>
            ))}
          </select>
        )}
        {tab === 'spells' && (
          <>
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value={-1}>Any level</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'Cantrip' : `Level ${i}`}
                </option>
              ))}
            </select>
            <select value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">Any school</option>
              {schools.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </>
        )}
        {tab === 'items' && (
          <>
            <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
              <option value="">Any type</option>
              {itemTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">Any rarity</option>
              {rarities.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {!data && <p className="dim">Loading compendium…</p>}

      {tab === 'monsters' && (
        <ul className="result-list">
          {monsters.map((m) => (
            <MonsterRow key={m.entry.id + m.origin.kind} entry={m} onPreview={() => setPreview(m.entry)} onAdd={addMonster} />
          ))}
          {data && monsters.length === 0 && <li className="dim">No matches.</li>}
        </ul>
      )}

      {tab === 'spells' && (
        <ul className="result-list">
          {spells.map((s) => (
            <TextRow
              key={s.entry.id + s.origin.kind}
              name={s.entry.name}
              meta={`${s.entry.level === 0 ? 'Cantrip' : `Level ${s.entry.level}`} · ${s.entry.school}${s.entry.concentration ? ' · Conc.' : ''}`}
              origin={s.origin}
              detail={[
                `Casting Time: ${s.entry.castingTime} · Range: ${s.entry.range} · Duration: ${s.entry.duration}`,
                `Components: ${s.entry.components}`,
                ...s.entry.text,
                ...s.entry.higherLevel,
              ]}
            />
          ))}
          {data && spells.length === 0 && <li className="dim">No matches.</li>}
        </ul>
      )}

      {tab === 'items' && (
        <ul className="result-list">
          {items.map((i) => (
            <TextRow
              key={i.entry.id + i.origin.kind}
              name={i.entry.name}
              meta={`${i.entry.typeName}${i.entry.rarity ? ` · ${i.entry.rarity}` : ''}${i.entry.attunement ? ' · Attunement' : ''}`}
              origin={i.origin}
              detail={i.entry.text}
            />
          ))}
          {data && items.length === 0 && <li className="dim">No matches.</li>}
        </ul>
      )}

      {notice && <div className="toast">{notice}</div>}
    </Modal>
  )
}

function MonsterRow({
  entry: { entry: sb, origin },
  onPreview,
  onAdd,
}: {
  entry: CompendiumEntry<Statblock>
  onPreview: () => void
  onAdd: (sb: Statblock, count: number, isPC: boolean) => void
}) {
  const [count, setCount] = useState(1)
  const isPC = origin.kind === 'homebrew' && origin.isPC
  return (
    <li className="result-row">
      <button type="button" className="result-main" onClick={onPreview}>
        <span className="result-name">
          {sb.name} <OriginBadge origin={origin} />
        </span>
        <span className="result-meta dim">
          CR {sb.cr ?? '—'} · {sb.type} · AC {sb.ac} · HP {sb.hp.average}
        </span>
      </button>
      <span className="stepper">
        <button type="button" aria-label="Fewer" onClick={() => setCount(Math.max(1, count - 1))}>
          −
        </button>
        <span className="rounds-label">{count}</span>
        <button type="button" aria-label="More" onClick={() => setCount(Math.min(20, count + 1))}>
          +
        </button>
      </span>
      <button type="button" className="primary" onClick={() => onAdd(sb, count, isPC)}>
        Add
      </button>
    </li>
  )
}

function TextRow({
  name,
  meta,
  origin,
  detail,
}: {
  name: string
  meta: string
  origin: Origin
  detail: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="result-row column">
      <button type="button" className="result-main" onClick={() => setOpen(!open)}>
        <span className="result-name">
          {name} <OriginBadge origin={origin} />
        </span>
        <span className="result-meta dim">{meta}</span>
      </button>
      {open && (
        <div className="result-detail">
          {detail.map((t, i) => (
            <p key={i}>{renderTags(t)}</p>
          ))}
        </div>
      )}
    </li>
  )
}
