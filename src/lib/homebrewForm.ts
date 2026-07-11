// Conversion between the flat homebrew editor form and the normalized
// Statblock model. The form keeps everything as strings for direct binding.

import { abilityMod, type Ability, type Statblock, type StatblockEntry } from '../types'

export interface EntryForm {
  name: string
  text: string
}

export interface HomebrewForm {
  name: string
  size: string
  type: string
  alignment: string
  ac: string
  acFrom: string
  hpAverage: string
  hpFormula: string
  speedWalk: string
  speedFly: string
  speedSwim: string
  speedClimb: string
  speedBurrow: string
  str: string
  dex: string
  con: string
  int: string
  wis: string
  cha: string
  savesText: string
  skillsText: string
  sensesText: string
  languagesText: string
  cr: string
  initiativeBonus: string
  immunities: string
  resistances: string
  vulnerabilities: string
  gearText: string
  traits: EntryForm[]
  actions: EntryForm[]
  bonusActions: EntryForm[]
  reactions: EntryForm[]
  legendary: EntryForm[]
}

export const emptyForm: HomebrewForm = {
  name: '',
  size: 'M',
  type: 'humanoid',
  alignment: 'Unaligned',
  ac: '10',
  acFrom: '',
  hpAverage: '10',
  hpFormula: '',
  speedWalk: '30',
  speedFly: '',
  speedSwim: '',
  speedClimb: '',
  speedBurrow: '',
  str: '10',
  dex: '10',
  con: '10',
  int: '10',
  wis: '10',
  cha: '10',
  savesText: '',
  skillsText: '',
  sensesText: '',
  languagesText: '',
  cr: '',
  initiativeBonus: '',
  immunities: '',
  resistances: '',
  vulnerabilities: '',
  gearText: '',
  traits: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  legendary: [],
}

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function num(value: string, fallback = 0): number {
  const n = Number.parseInt(value.trim(), 10)
  return Number.isNaN(n) ? fallback : n
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** "perception +4, stealth +6" → { perception: 4, stealth: 6 } */
function parseBonusPairs(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of splitList(text)) {
    const match = part.match(/^(.+?)\s*([+-]\d+)$/)
    if (match) out[match[1].toLowerCase()] = Number.parseInt(match[2], 10)
  }
  return out
}

function bonusPairsText(record: Record<string, number>): string {
  return Object.entries(record)
    .map(([name, bonus]) => `${name} ${bonus >= 0 ? '+' : ''}${bonus}`)
    .join(', ')
}

function entriesFromForm(entries: EntryForm[]): StatblockEntry[] {
  return entries
    .filter((e) => e.name.trim() || e.text.trim())
    .map((e) => ({
      name: e.name.trim() || undefined,
      text: e.text
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean),
    }))
}

function entriesToForm(entries: StatblockEntry[]): EntryForm[] {
  return entries.map((e) => ({ name: e.name ?? '', text: e.text.join('\n') }))
}

function parseCrNumeric(cr: string): number | undefined {
  if (!cr.trim()) return undefined
  const [n, d] = cr.split('/')
  const value = d ? Number(n) / Number(d) : Number(n)
  return Number.isNaN(value) ? undefined : value
}

export function formToStatblock(form: HomebrewForm, id: string): Statblock {
  const abilities = {
    str: num(form.str, 10),
    dex: num(form.dex, 10),
    con: num(form.con, 10),
    int: num(form.int, 10),
    wis: num(form.wis, 10),
    cha: num(form.cha, 10),
  }
  const saves: Partial<Record<Ability, number>> = {}
  for (const [name, bonus] of Object.entries(parseBonusPairs(form.savesText))) {
    if ((ABILITIES as string[]).includes(name)) saves[name as Ability] = bonus
  }
  const speed = [
    { mode: 'walk', value: num(form.speedWalk, 0) },
    { mode: 'fly', value: num(form.speedFly, 0) },
    { mode: 'swim', value: num(form.speedSwim, 0) },
    { mode: 'climb', value: num(form.speedClimb, 0) },
    { mode: 'burrow', value: num(form.speedBurrow, 0) },
  ].filter((s) => s.value > 0)

  const legendary = entriesFromForm(form.legendary)
  const cr = form.cr.trim() || undefined

  return {
    id,
    name: form.name.trim() || 'Unnamed',
    source: 'HB',
    size: [form.size],
    type: form.type.trim() || 'unknown',
    typeTags: [],
    alignment: form.alignment.trim() || 'Unaligned',
    ac: num(form.ac, 10),
    acFrom: form.acFrom.trim() || undefined,
    hp: { average: num(form.hpAverage, 1), formula: form.hpFormula.trim() || undefined },
    speed,
    abilities,
    saves,
    skills: parseBonusPairs(form.skillsText),
    senses: splitList(form.sensesText),
    passivePerception: undefined,
    languages: splitList(form.languagesText),
    cr,
    crNumeric: parseCrNumeric(form.cr),
    initiativeBonus: form.initiativeBonus.trim() ? num(form.initiativeBonus) : abilityMod(abilities.dex),
    immunities: form.immunities.trim() || undefined,
    resistances: form.resistances.trim() || undefined,
    vulnerabilities: form.vulnerabilities.trim() || undefined,
    gear: splitList(form.gearText),
    traits: entriesFromForm(form.traits),
    actions: entriesFromForm(form.actions),
    bonusActions: entriesFromForm(form.bonusActions),
    reactions: entriesFromForm(form.reactions),
    legendary,
    legendaryActions: legendary.length ? 3 : undefined,
    lair: [],
    spellcasting: [],
  }
}

export function statblockToForm(sb: Statblock): HomebrewForm {
  const speedOf = (mode: string) => {
    const s = sb.speed.find((x) => x.mode === mode)
    return s ? String(s.value) : ''
  }
  return {
    name: sb.name,
    size: sb.size[0] ?? 'M',
    type: sb.type,
    alignment: sb.alignment,
    ac: String(sb.ac),
    acFrom: sb.acFrom ?? '',
    hpAverage: String(sb.hp.average),
    hpFormula: sb.hp.formula ?? '',
    speedWalk: speedOf('walk'),
    speedFly: speedOf('fly'),
    speedSwim: speedOf('swim'),
    speedClimb: speedOf('climb'),
    speedBurrow: speedOf('burrow'),
    str: String(sb.abilities.str),
    dex: String(sb.abilities.dex),
    con: String(sb.abilities.con),
    int: String(sb.abilities.int),
    wis: String(sb.abilities.wis),
    cha: String(sb.abilities.cha),
    savesText: bonusPairsText(sb.saves as Record<string, number>),
    skillsText: bonusPairsText(sb.skills),
    sensesText: sb.senses.join(', '),
    languagesText: sb.languages.join(', '),
    cr: sb.cr ?? '',
    initiativeBonus: String(sb.initiativeBonus),
    immunities: sb.immunities ?? '',
    resistances: sb.resistances ?? '',
    vulnerabilities: sb.vulnerabilities ?? '',
    gearText: sb.gear.join(', '),
    traits: entriesToForm(sb.traits),
    actions: entriesToForm(sb.actions),
    bonusActions: entriesToForm(sb.bonusActions),
    reactions: entriesToForm(sb.reactions),
    legendary: entriesToForm(sb.legendary),
  }
}
