import { useState } from 'react'
import { db } from '../db'
import { newId } from '../lib/id'
import {
  emptyForm,
  formToStatblock,
  statblockToForm,
  type EntryForm,
  type HomebrewForm,
} from '../lib/homebrewForm'
import { mdiClose, mdiPlus } from '@mdi/js'
import type { HomebrewEntry, HomebrewKind } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface HomebrewEditorProps {
  existing?: HomebrewEntry
  kind: HomebrewKind
  onClose: () => void
}

const SIZES = ['T', 'S', 'M', 'L', 'H', 'G']

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
      <button type="button" className="icon-label" onClick={() => onChange([...entries, { name: '', text: '' }])}>
        <Icon path={mdiPlus} /> {label} entry
      </button>
    </section>
  )
}

export function HomebrewEditor({ existing, kind, onClose }: HomebrewEditorProps) {
  const [form, setForm] = useState<HomebrewForm>(existing ? statblockToForm(existing.statblock) : emptyForm)
  const isPC = kind === 'pc'
  const set = (patch: Partial<HomebrewForm>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.name.trim()) return
    const id = existing?.id ?? `hb-${newId()}`
    const now = Date.now()
    const entry: HomebrewEntry = {
      id,
      kind,
      statblock: formToStatblock(form, id),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.homebrew.put(entry)
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

  return (
    <Modal title={existing ? `Edit — ${existing.statblock.name}` : isPC ? 'New PC' : 'New homebrew monster'} onClose={onClose}>
      <div className="form-grid">
        {text('name', 'Name')}
        {text('ac', 'AC')}
        {text('hpAverage', 'Max HP')}
        {text('initiativeBonus', 'Initiative bonus', 'blank = DEX mod')}
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
        {!isPC && text('hpFormula', 'HP formula', 'e.g. 11d8+33')}
        {!isPC && text('acFrom', 'AC from', 'e.g. natural armor')}
      </div>

      <h3>Abilities</h3>
      <div className="hb-abilities">
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => (
          <label key={a}>
            {a.toUpperCase()}
            <input
              inputMode="numeric"
              value={form[a]}
              onChange={(e) => set({ [a]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <div className="form-grid">
        {text('savesText', 'Saves', 'e.g. dex +5, wis +2')}
        {text('skillsText', 'Skills', 'e.g. perception +4')}
        {text('sensesText', 'Senses', 'e.g. Darkvision 60 ft.')}
        {text('languagesText', 'Languages', 'comma-separated')}
        <label>
          Speed (walk)
          <input inputMode="numeric" value={form.speedWalk} onChange={(e) => set({ speedWalk: e.target.value })} />
        </label>
        {!isPC && text('speedFly', 'Fly')}
        {!isPC && text('speedSwim', 'Swim')}
        {!isPC && text('speedClimb', 'Climb')}
        {!isPC && text('immunities', 'Immunities')}
        {!isPC && text('resistances', 'Resistances')}
        {!isPC && text('vulnerabilities', 'Vulnerabilities')}
        {!isPC && text('gearText', 'Gear', 'comma-separated')}
      </div>

      <EntryListEditor label={isPC ? 'Notes' : 'Traits'} entries={form.traits} onChange={(traits) => set({ traits })} />
      {!isPC && (
        <>
          <EntryListEditor label="Actions" entries={form.actions} onChange={(actions) => set({ actions })} />
          <EntryListEditor
            label="Bonus Actions"
            entries={form.bonusActions}
            onChange={(bonusActions) => set({ bonusActions })}
          />
          <EntryListEditor label="Reactions" entries={form.reactions} onChange={(reactions) => set({ reactions })} />
          <EntryListEditor label="Legendary" entries={form.legendary} onChange={(legendary) => set({ legendary })} />
        </>
      )}

      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" disabled={!form.name.trim()} onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  )
}
