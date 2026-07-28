import { mdiArrowLeft } from '@mdi/js'
import { useMemo, useState, type ReactNode } from 'react'
import {
  entryKey,
  originBadgeClass,
  originBadgeLabel,
  useCompendium,
  type CompendiumEntry,
  type Origin,
} from '../data/compendium'
import { sourceLabel } from '../lib/format'
import { rankByName, stripPostfix, suffixedNames } from '../lib/search'
import { battleStore } from '../store/battleStore'
import { combatantFromStatblock } from '../store/createCombatant'
import type { Statblock } from '../types'
import { ApplyCondition } from './ApplyCondition'
import { CreatureInfo } from './CreatureInfo'
import { DiceRoller } from './DiceRoller'
import { Icon } from './Icon'
import { ItemInfo } from './ItemInfo'
import { ItemPrice } from './ItemPrice'
import { Modal } from './Modal'
import { RuleInfo } from './RuleInfo'
import { SpellInfo } from './SpellInfo'
import { StatblockPanel } from './StatblockPanel'
import { TaggedText } from './TaggedText'

/** Link handlers threaded into expanded spell/item/rule rows. */
interface DetailActions {
  onDice: (expr: string) => void
  onCondition: (name: string) => void
  onSpell: (name: string) => void
  onItem: (name: string) => void
  onCreature: (name: string) => void
  onRule: (name: string) => void
}

type Tab = 'monsters' | 'pcs' | 'spells' | 'items' | 'rules'

const CR_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'Any CR', min: -1, max: 99 },
  { label: 'CR 0–1', min: 0, max: 1 },
  { label: 'CR 2–4', min: 2, max: 4 },
  { label: 'CR 5–10', min: 5, max: 10 },
  { label: 'CR 11–16', min: 11, max: 16 },
  { label: 'CR 17+', min: 17, max: 99 },
]

/** Provenance next to the name. The meta line carries the book citation, which
 *  reads the same for SRD and for a pack — this is what distinguishes them. */
function OriginBadge({ origin }: { origin: Origin }) {
  return <span className={`badge ${originBadgeClass(origin)}`}>{originBadgeLabel(origin)}</span>
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
  // isPC travels with the previewed entry: the preview's "Add to battle" needs
  // it, and the entry alone no longer says which section it came from.
  const [preview, setPreview] = useState<{ entry: CompendiumEntry<Statblock>; isPC: boolean } | null>(null)
  const [notice, setNotice] = useState('')
  const [rollExpr, setRollExpr] = useState<string | null>(null)
  const [conditionFor, setConditionFor] = useState<string | null>(null)
  const [spellFor, setSpellFor] = useState<string | null>(null)
  const [itemFor, setItemFor] = useState<string | null>(null)
  const [creatureFor, setCreatureFor] = useState<string | null>(null)
  const [ruleFor, setRuleFor] = useState<string | null>(null)
  const actions: DetailActions = {
    onDice: setRollExpr,
    onCondition: setConditionFor,
    onSpell: setSpellFor,
    onItem: setItemFor,
    onCreature: setCreatureFor,
    onRule: setRuleFor,
  }

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

  // PCs have no CR, level or rarity to filter on — the search box is the whole
  // filter row. The list is deliberately not grouped or filtered by pack: PCs
  // are looked up by player name, whichever pack happens to hold them.
  const pcs = useMemo(() => {
    if (!data) return []
    return rankByName(data.pcs, query, (m) => m.entry.name).slice(0, 100)
  }, [data, query])

  const rules = useMemo(() => {
    if (!data) return []
    return rankByName(data.rules, query, (r) => r.entry.name).slice(0, 100)
  }, [data, query])

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

  // The PC tab only exists once there are PCs to put in it, so the selected tab
  // can vanish under the user (deleting the last PC). Fall back rather than
  // render a tab body with nothing behind it.
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'monsters', label: 'Monsters', show: true },
    { id: 'pcs', label: 'PCs', show: (data?.pcs.length ?? 0) > 0 },
    { id: 'spells', label: 'Spells', show: true },
    { id: 'items', label: 'Items', show: true },
    { id: 'rules', label: 'Rules', show: true },
  ]
  const shownTab: Tab = tabs.some((t) => t.id === tab && t.show) ? tab : 'monsters'

  if (preview) {
    return (
      <Modal title={preview.entry.entry.name} className="modal-wide" onClose={() => setPreview(null)}>
        <StatblockPanel
          combatant={combatantFromStatblock(preview.entry.entry)}
          origin={preview.entry.origin}
          pinned={false}
          onTogglePin={() => {}}
        />
        <div className="modal-actions">
          <button type="button" className="ghost icon-label" onClick={() => setPreview(null)}>
            <Icon path={mdiArrowLeft} /> Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              addMonster(preview.entry.entry, 1, preview.isPC)
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
    <Modal title="Compendium" className="modal-wide modal-split" onClose={onClose}>
      {/* Fixed band: tabs and filters stay put while only the results scroll. */}
      <div className="modal-controls">
        <div className="sb-tabs">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                className={shownTab === t.id ? 'primary' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
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
          {shownTab === 'monsters' && (
            <select value={crBucket} onChange={(e) => setCrBucket(Number(e.target.value))}>
              {CR_BUCKETS.map((b, i) => (
                <option key={b.label} value={i}>
                  {b.label}
                </option>
              ))}
            </select>
          )}
          {shownTab === 'spells' && (
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
          {shownTab === 'items' && (
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
      </div>

      <div className="modal-scroll">
        {!data && <p className="dim">Loading compendium…</p>}

        {shownTab === 'monsters' && (
          <ul className="result-list">
            {monsters.map((m) => (
              <MonsterRow
                key={entryKey(m.origin, m.entry.id)}
                entry={m}
                isPC={false}
                onPreview={() => setPreview({ entry: m, isPC: false })}
                onAdd={addMonster}
              />
            ))}
            {data && monsters.length === 0 && <li className="dim">No matches.</li>}
          </ul>
        )}

        {shownTab === 'pcs' && (
          <ul className="result-list">
            {pcs.map((p) => (
              <MonsterRow
                key={entryKey(p.origin, p.entry.id)}
                entry={p}
                isPC
                onPreview={() => setPreview({ entry: p, isPC: true })}
                onAdd={addMonster}
              />
            ))}
            {data && pcs.length === 0 && <li className="dim">No matches.</li>}
          </ul>
        )}

        {shownTab === 'spells' && (
          <ul className="result-list">
            {spells.map((s) => (
              <TextRow
                key={entryKey(s.origin, s.entry.id)}
                name={s.entry.name}
                meta={`${s.entry.level === 0 ? 'Cantrip' : `Level ${s.entry.level}`} · ${s.entry.school}${s.entry.concentration ? ' · Conc.' : ''} · ${sourceLabel(s.entry.source, s.entry.page)}`}
                origin={s.origin}
                detail={[
                  `Casting Time: ${s.entry.castingTime} · Range: ${s.entry.range} · Duration: ${s.entry.duration}`,
                  `Components: ${s.entry.components}`,
                  ...s.entry.text,
                  ...s.entry.higherLevel,
                ]}
                actions={actions}
              />
            ))}
            {data && spells.length === 0 && <li className="dim">No matches.</li>}
          </ul>
        )}

        {shownTab === 'items' && (
          <ul className="result-list">
            {items.map((i) => (
              <TextRow
                key={entryKey(i.origin, i.entry.id)}
                name={i.entry.name}
                meta={
                  <>
                    {i.entry.typeName}
                    {i.entry.rarity && ` · ${i.entry.rarity}`}
                    {i.entry.attunement && ' · Attunement'}
                    <ItemPrice item={i.entry} prefix=" · " />
                    {` · ${sourceLabel(i.entry.source, i.entry.page)}`}
                  </>
                }
                origin={i.origin}
                detail={i.entry.text}
                actions={actions}
              />
            ))}
            {data && items.length === 0 && <li className="dim">No matches.</li>}
          </ul>
        )}

        {shownTab === 'rules' && (
          <ul className="result-list">
            {rules.map((r) => (
              <TextRow
                key={entryKey(r.origin, r.entry.id)}
                name={r.entry.name}
                meta={sourceLabel(r.entry.source, r.entry.page)}
                origin={r.origin}
                detail={r.entry.text}
                actions={actions}
              />
            ))}
            {data && rules.length === 0 && <li className="dim">No matches.</li>}
          </ul>
        )}
      </div>

      {/* reference modals stack over the compendium; dice/condition dialogs above those */}
      {creatureFor !== null && <CreatureInfo name={creatureFor} onClose={() => setCreatureFor(null)} />}
      {itemFor !== null && <ItemInfo name={itemFor} {...actions} onClose={() => setItemFor(null)} />}
      {spellFor !== null && <SpellInfo name={spellFor} {...actions} onClose={() => setSpellFor(null)} />}
      {ruleFor !== null && <RuleInfo name={ruleFor} {...actions} onClose={() => setRuleFor(null)} />}
      {rollExpr !== null && <DiceRoller allowApply initialExpression={rollExpr} onClose={() => setRollExpr(null)} />}
      {conditionFor !== null && <ApplyCondition name={conditionFor} onClose={() => setConditionFor(null)} />}

      {notice && <div className="toast">{notice}</div>}
    </Modal>
  )
}

/** One creature row, shared by the Monsters and PCs tabs. `isPC` comes from the
 *  section the row was rendered for, not from the entry — the same statblock
 *  shape is used for both. */
function MonsterRow({
  entry: { entry: sb, origin },
  isPC,
  onPreview,
  onAdd,
}: {
  entry: CompendiumEntry<Statblock>
  isPC: boolean
  onPreview: () => void
  onAdd: (sb: Statblock, count: number, isPC: boolean) => void
}) {
  const [count, setCount] = useState(1)
  return (
    <li className="result-row">
      <button type="button" className="result-main" onClick={onPreview}>
        <span className="result-name">
          {sb.name} <OriginBadge origin={origin} />
        </span>
        {/* CR is a monster's threat rating and says nothing about a PC. */}
        <span className="result-meta dim">
          {!isPC && `CR ${sb.cr ?? '—'} · `}
          {sb.type} · AC {sb.ac} · HP {sb.hp.average} · {sourceLabel(sb.source, sb.page)}
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
  actions,
}: {
  name: string
  /** ReactNode rather than string so the items row can style its price segment. */
  meta: ReactNode
  origin: Origin
  detail: string[]
  actions: DetailActions
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
            <p key={i}>
              <TaggedText text={t} {...actions} />
            </p>
          ))}
        </div>
      )}
    </li>
  )
}
