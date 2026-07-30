import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteHomebrewEntry, saveHomebrewEntry } from '../data/homebrewPack'
import { newId } from '../lib/id'
import {
  emptyForm,
  formToStatblock,
  statblockToForm,
  type EntryForm,
  type HomebrewForm,
} from '../lib/homebrewForm'
import { mdiClose, mdiPlus } from '@mdi/js'
import { abilityMod, type CreatureSection, type Statblock } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface HomebrewEditorProps {
  existing?: Statblock
  /** Which section of the Homebrew pack the entry belongs to. */
  section: CreatureSection
  onClose: () => void
}

const SIZES = ['T', 'S', 'M', 'L', 'H', 'G']

/** Five-up speed grid; an empty field renders as a dim em dash. */
const SPEEDS = [
  { key: 'speedWalk', label: 'Walk' },
  { key: 'speedFly', label: 'Fly' },
  { key: 'speedSwim', label: 'Swim' },
  { key: 'speedClimb', label: 'Climb' },
  { key: 'speedBurrow', label: 'Burrow' },
] as const

function EntryListEditor({
  label,
  entries,
  onChange,
}: {
  label: string
  entries: EntryForm[]
  onChange: (entries: EntryForm[]) => void
}) {
  const update = (i: number, patch: Partial<EntryForm>) =>
    onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <section className="hb-entries">
      <h3>{label}</h3>
      {entries.map((entry, i) => (
        <div key={i} className="hb-entry">
          <div className="hb-entry-head">
            <input
              placeholder="Name (e.g. Multiattack)"
              value={entry.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              type="button"
              className="ghost"
              aria-label={`Remove ${label} entry`}
              onClick={() => onChange(entries.filter((_, j) => j !== i))}
            >
              <Icon path={mdiClose} />
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="Text — one paragraph per line"
            value={entry.text}
            onChange={(e) => update(i, { text: e.target.value })}
          />
        </div>
      ))}
      {/* Dashed, because the row it adds does not exist yet. */}
      <button type="button" className="icon-label hb-add" onClick={() => onChange([...entries, { name: '', text: '' }])}>
        <Icon path={mdiPlus} /> Add {label.toLowerCase()}
      </button>
    </section>
  )
}

export function HomebrewEditor({ existing, section, onClose }: HomebrewEditorProps) {
  const [form, setForm] = useState<HomebrewForm>(existing ? statblockToForm(existing) : emptyForm)
  // Which section the entry is saved to. Editable, so an entry created as a
  // monster can be turned into a PC without being retyped.
  const [target, setTarget] = useState<CreatureSection>(section)
  const isPC = target === 'pcs'
  const set = (patch: Partial<HomebrewForm>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.name.trim()) return
    const id = existing?.id ?? `hb-${newId()}`
    await saveHomebrewEntry({
      section: target,
      statblock: formToStatblock(form, id),
      removeFrom: existing && target !== section ? section : undefined,
    })
    onClose()
  }

  const text = (key: keyof HomebrewForm, label: string, placeholder = '') => (
    <label>
      {label}
      <input
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </label>
  )

  // The one long form in the app. The section nav is what makes it usable: it
  // jumps to Actions without scrolling past forty fields.
  const sections = useMemo(
    () => [
      { id: 'identity', label: 'Identity' },
      { id: 'defense', label: 'Defense & movement' },
      { id: 'abilities', label: 'Ability scores' },
      { id: 'skills', label: 'Skills & senses' },
      { id: 'traits', label: isPC ? 'Notes' : 'Traits' },
      ...(isPC ? [] : [{ id: 'actions', label: 'Actions' }, { id: 'legendary', label: 'Legendary' }]),
    ],
    [isPC],
  )

  // The nav is a segment group, so one of its segments has to be lit: without
  // it the form is forty fields with no answer to "where am I". It follows the
  // scroll rather than only the last tap, so scrolling into Actions lights
  // Actions.
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const scrollRef = useRef<HTMLDivElement>(null)

  const jumpTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(`hb-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top
      // The section whose heading last passed the top of the scroll region —
      // a little below it, so a heading just about to leave still counts.
      let current = sections[0].id
      for (const s of sections) {
        const heading = document.getElementById(`hb-${s.id}`)
        if (heading && heading.getBoundingClientRect().top - top <= 24) current = s.id
      }
      setActiveSection(current)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [sections])

  return (
    <Modal
      title={existing ? `Edit — ${existing.name}` : isPC ? 'New PC' : 'New homebrew monster'}
      className="modal-wide modal-split"
      onClose={onClose}
    >
      <div className="modal-controls">
        <nav className="hb-nav segments" aria-label="Form sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={activeSection === s.id}
              onClick={() => jumpTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="modal-scroll" ref={scrollRef}>
      <h3 id="hb-identity" className="section-heading">
        Identity
      </h3>
      <div className="form-grid">
        {text('name', 'Name')}
        <label>
          Kind
          <select value={target} onChange={(e) => setTarget(e.target.value as CreatureSection)}>
            <option value="monsters">Monster</option>
            <option value="pcs">Player character</option>
          </select>
        </label>
        {!isPC && (
          <label>
            Size
            <select value={form.size} onChange={(e) => set({ size: e.target.value })}>
              {SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        {!isPC && text('type', 'Type', 'e.g. dragon')}
        {!isPC && text('alignment', 'Alignment')}
        {!isPC && text('cr', 'CR', 'e.g. 5 or 1/2')}
      </div>

      <h3 id="hb-defense" className="section-heading">
        Defense &amp; movement
      </h3>
      <div className="form-grid">
        {text('ac', 'AC')}
        {text('hpAverage', 'Max HP')}
        {text('initiativeBonus', 'Initiative bonus', 'blank = DEX mod')}
        {!isPC && text('hpFormula', 'HP formula', 'e.g. 11d8+33')}
        {!isPC && text('acFrom', 'AC from', 'e.g. natural armor')}
        {!isPC && text('immunities', 'Immunities')}
        {!isPC && text('resistances', 'Resistances')}
        {!isPC && text('vulnerabilities', 'Vulnerabilities')}
      </div>
      <div className="hb-speeds">
        {SPEEDS.filter((s) => !isPC || s.key === 'speedWalk').map((s) => (
          <label key={s.key}>
            {s.label}
            <input
              inputMode="numeric"
              placeholder="—"
              value={form[s.key]}
              onChange={(e) => set({ [s.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <h3 id="hb-abilities" className="section-heading">
        Ability scores
      </h3>
      <div className="hb-abilities">
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => {
          const score = Number.parseInt(form[a], 10)
          const mod = Number.isFinite(score) ? abilityMod(score) : null
          return (
            <label key={a}>
              {a.toUpperCase()}
              <input inputMode="numeric" value={form[a]} onChange={(e) => set({ [a]: e.target.value })} />
              <span className="hb-ability-mod">{mod === null ? '—' : mod >= 0 ? `+${mod}` : mod}</span>
            </label>
          )
        })}
      </div>

      <h3 id="hb-skills" className="section-heading">
        Skills &amp; senses
      </h3>
      <div className="form-grid">
        {text('savesText', 'Saves', 'e.g. dex +5, wis +2')}
        {text('skillsText', 'Skills', 'e.g. perception +4')}
        {text('sensesText', 'Senses', 'e.g. Darkvision 60 ft.')}
        {text('languagesText', 'Languages', 'comma-separated')}
        {!isPC && text('gearText', 'Gear', 'comma-separated')}
      </div>

      <p className="dim hb-tags-note">
        Rules text takes the same reference tags as the compendium — <code>{'{@damage 2d6}'}</code>,{' '}
        <code>{'{@condition Prone}'}</code> — and they become tappable links wherever the statblock is shown.
      </p>

      <div id="hb-traits">
        <EntryListEditor
          label={isPC ? 'Notes' : 'Traits'}
          entries={form.traits}
          onChange={(traits) => set({ traits })}
        />
      </div>
      {!isPC && (
        <>
          <div id="hb-actions">
            <EntryListEditor label="Actions" entries={form.actions} onChange={(actions) => set({ actions })} />
            <EntryListEditor
              label="Bonus Actions"
              entries={form.bonusActions}
              onChange={(bonusActions) => set({ bonusActions })}
            />
            <EntryListEditor label="Reactions" entries={form.reactions} onChange={(reactions) => set({ reactions })} />
          </div>
          <div id="hb-legendary">
            <EntryListEditor label="Legendary" entries={form.legendary} onChange={(legendary) => set({ legendary })} />
          </div>
        </>
      )}
      </div>

      <div className="modal-footer">
        {existing && (
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm(`Delete "${existing.name}"?`)) {
                deleteHomebrewEntry(section, existing.id).then(onClose, (err: unknown) =>
                  console.error('Delete failed:', err),
                )
              }
            }}
          >
            Delete
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ok" disabled={!form.name.trim()} onClick={save}>
          {isPC ? 'Save PC' : 'Save monster'}
        </button>
      </div>
    </Modal>
  )
}
