// Parses raw upstream JSON (2024 schema, tolerating 2014-era variants) into
// the normalized types from src/types.ts. Inline {@…} tags are kept in the
// text; rendering resolves them (see tagRenderer.ts).

import {
  abilityMod,
  proficiencyByCr,
  type Ability,
  type AbilityScores,
  type Item,
  type Rule,
  type Spell,
  type SpeedEntry,
  type SpellcastingBlock,
  type SpellcastingList,
  type Statblock,
  type StatblockEntry,
} from '../types.ts'

// ---------- raw schema (loose but typed) ----------

type RawEntry =
  | string
  | {
      type?: string
      name?: string
      entries?: RawEntry[]
      items?: RawEntry[]
      entry?: RawEntry
      caption?: string
      colLabels?: string[]
      rows?: unknown[][]
    }

interface RawNamedBlock {
  name?: string
  entries?: RawEntry[]
}

type RawDamageListItem =
  | string
  | {
      special?: string
      note?: string
      preNote?: string
      immune?: RawDamageListItem[]
      resist?: RawDamageListItem[]
      vulnerable?: RawDamageListItem[]
      conditionImmune?: RawDamageListItem[]
    }

interface RawSpellcasting {
  name?: string
  headerEntries?: RawEntry[]
  ability?: string
  displayAs?: string
  hidden?: string[]
  will?: string[]
  daily?: Record<string, string[]>
  restLong?: Record<string, string[]>
  recharge?: Record<string, string[]>
  legendary?: Record<string, string[]>
  charges?: Record<string, string[]>
  spells?: Record<string, { slots?: number; spells: string[] }>
}

interface RawMonster {
  name: string
  source?: string
  page?: number
  size?: string[]
  type?: string | { type?: string | { choose?: string[] }; tags?: (string | { tag?: string; prefix?: string })[] }
  alignment?: (string | { alignment?: string[] })[]
  ac?: (number | { ac?: number; from?: string[]; special?: string })[]
  hp?: { average?: number; formula?: string; special?: string }
  speed?: Record<string, unknown> & { canHover?: boolean }
  str?: number
  dex?: number
  con?: number
  int?: number
  wis?: number
  cha?: number
  save?: Record<string, string>
  skill?: Record<string, unknown>
  senses?: string[]
  passive?: number | string
  languages?: string[]
  cr?: string | { cr?: string; xp?: number; xpLair?: number }
  initiative?: number | { proficiency?: number; initiative?: number }
  immune?: RawDamageListItem[]
  resist?: RawDamageListItem[]
  vulnerable?: RawDamageListItem[]
  conditionImmune?: RawDamageListItem[]
  gear?: (string | { item?: string; quantity?: number })[]
  trait?: RawNamedBlock[]
  action?: RawNamedBlock[]
  bonus?: RawNamedBlock[]
  reaction?: RawNamedBlock[]
  legendary?: RawNamedBlock[]
  legendaryHeader?: RawEntry[]
  legendaryActions?: number
  spellcasting?: RawSpellcasting[]
}

// ---------- shared helpers ----------

export function slugId(name: string, source: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${source.toLowerCase()}-${slug}`
}

/** Flattens nested entry structures (paragraphs, lists, sub-entries, tables) into plain lines. */
export function flattenEntries(entries: RawEntry[] | undefined): string[] {
  const out: string[] = []
  for (const entry of entries ?? []) flattenEntry(entry, out)
  return out
}

function flattenEntry(entry: RawEntry, out: string[], bullet = ''): void {
  if (typeof entry === 'string') {
    out.push(bullet + entry)
    return
  }
  if (entry.type === 'list') {
    for (const item of entry.items ?? []) flattenEntry(item, out, '• ')
    return
  }
  if (entry.type === 'table') {
    if (entry.caption) out.push(bullet + entry.caption)
    if (entry.colLabels?.length) out.push(entry.colLabels.join(' | '))
    for (const row of entry.rows ?? []) {
      out.push(row.map((cell) => renderTableCell(cell)).join(' | '))
    }
    return
  }
  // named sub-entry ({type:"entries"|"item", name?, entries?|entry?})
  const inner: string[] = []
  if (entry.entry !== undefined) flattenEntry(entry.entry, inner)
  for (const e of entry.entries ?? []) flattenEntry(e, inner)
  if (entry.name && inner.length) inner[0] = `${entry.name}. ${inner[0]}`
  else if (entry.name && !inner.length) inner.push(entry.name)
  if (inner.length) {
    inner[0] = bullet + inner[0]
    out.push(...inner)
  }
}

function renderTableCell(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell)
  if (typeof cell === 'object') {
    const c = cell as { roll?: { exact?: number; min?: number; max?: number }; entry?: RawEntry }
    if (c.roll) {
      if (c.roll.exact !== undefined) return String(c.roll.exact)
      return `${c.roll.min ?? ''}–${c.roll.max ?? ''}`
    }
    if (c.entry !== undefined) {
      const inner: string[] = []
      flattenEntry(c.entry, inner)
      return inner.join(' ')
    }
  }
  return String(cell)
}

function parseBonus(value: unknown): number {
  const n = Number.parseInt(String(value).replace('+', '').trim(), 10)
  return Number.isNaN(n) ? 0 : n
}

// ---------- monster ----------

const ALIGNMENT_NAMES: Record<string, string> = {
  L: 'Lawful',
  N: 'Neutral',
  NX: 'Neutral',
  NY: 'Neutral',
  C: 'Chaotic',
  G: 'Good',
  E: 'Evil',
  U: 'Unaligned',
  A: 'Any Alignment',
}

const SPEED_MODES = ['walk', 'burrow', 'climb', 'fly', 'swim'] as const

function parseAlignment(alignment: RawMonster['alignment']): string {
  if (!alignment?.length) return 'Unaligned'
  const parts: string[] = []
  for (const a of alignment) {
    if (typeof a === 'string') parts.push(ALIGNMENT_NAMES[a] ?? a)
    else if (a.alignment) parts.push(a.alignment.map((x) => ALIGNMENT_NAMES[x] ?? x).join(' '))
  }
  return parts.join(' ') || 'Unaligned'
}

function parseType(type: RawMonster['type']): { type: string; typeTags: string[] } {
  if (!type) return { type: 'unknown', typeTags: [] }
  if (typeof type === 'string') return { type, typeTags: [] }
  const base = typeof type.type === 'string' ? type.type : (type.type?.choose?.join(' or ') ?? 'unknown')
  const typeTags = (type.tags ?? []).map((t) => (typeof t === 'string' ? t : [t.prefix, t.tag].filter(Boolean).join(' ')))
  return { type: base, typeTags }
}

function parseAc(ac: RawMonster['ac']): { ac: number; acFrom?: string } {
  const first = ac?.[0]
  if (typeof first === 'number') return { ac: first }
  if (first && typeof first === 'object') {
    return { ac: first.ac ?? 10, acFrom: first.from?.join(', ') ?? first.special }
  }
  return { ac: 10 }
}

function parseSpeed(speed: RawMonster['speed']): SpeedEntry[] {
  const out: SpeedEntry[] = []
  if (!speed) return out
  for (const mode of SPEED_MODES) {
    const value = speed[mode]
    if (typeof value === 'number') {
      out.push({ mode, value, condition: mode === 'fly' && speed.canHover ? '(hover)' : undefined })
    } else if (value && typeof value === 'object') {
      const v = value as { number?: number; condition?: string }
      out.push({ mode, value: v.number ?? 0, condition: v.condition })
    }
  }
  return out
}

function parseCr(cr: RawMonster['cr']): { cr?: string; crNumeric?: number } {
  const display = typeof cr === 'string' ? cr : cr?.cr
  if (!display || display === 'Unknown' || display === '—') return {}
  const [num, denom] = display.split('/')
  const numeric = denom ? Number(num) / Number(denom) : Number(num)
  return { cr: display, crNumeric: Number.isNaN(numeric) ? undefined : numeric }
}

function parseDamageList(list: RawDamageListItem[] | undefined): string | undefined {
  if (!list?.length) return undefined
  const parts = list.map((item) => {
    if (typeof item === 'string') return item
    if (item.special) return item.special
    const nested = item.immune ?? item.resist ?? item.vulnerable ?? item.conditionImmune ?? []
    const inner = parseDamageList(nested) ?? ''
    return [item.preNote, inner, item.note].filter(Boolean).join(' ')
  })
  return parts.join('; ')
}

function parseNamedBlocks(blocks: RawNamedBlock[] | undefined): StatblockEntry[] {
  return (blocks ?? []).map((b) => ({ name: b.name, text: flattenEntries(b.entries) }))
}

const ORDINALS = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

function frequencyLists(
  record: Record<string, string[]> | undefined,
  labelFor: (n: string) => string,
): SpellcastingList[] {
  if (!record) return []
  return Object.entries(record)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, spells]) => {
      const each = key.endsWith('e')
      const n = each ? key.slice(0, -1) : key
      return {
        label: labelFor(n) + (each ? ' Each' : ''),
        uses: Number.parseInt(n, 10) || undefined,
        perSpell: each || undefined,
        spells,
      }
    })
}

function parseSpellcasting(blocks: RawSpellcasting[] | undefined): SpellcastingBlock[] {
  return (blocks ?? []).map((raw) => {
    const lists: SpellcastingList[] = []
    if (raw.will?.length) lists.push({ label: 'At Will', spells: raw.will })
    for (const [level, group] of Object.entries(raw.spells ?? {})) {
      const idx = Number.parseInt(level, 10)
      const label =
        idx === 0
          ? 'Cantrips (At Will)'
          : `${ORDINALS[idx] ?? `${idx}th`} Level${group.slots ? ` (${group.slots} Slots)` : ''}`
      lists.push({ label, uses: group.slots, spells: group.spells })
    }
    lists.push(...frequencyLists(raw.daily, (n) => `${n}/Day`))
    lists.push(...frequencyLists(raw.restLong, (n) => `${n}/Long Rest`))
    lists.push(...frequencyLists(raw.charges, (n) => `${n} Charges`))
    for (const [n, spells] of Object.entries(raw.recharge ?? {})) {
      lists.push({ label: n === '6' ? 'Recharge 6' : `Recharge ${n}–6`, spells })
    }
    lists.push(...frequencyLists(raw.legendary, (n) => `${n}/Legendary`))
    return {
      name: raw.name ?? 'Spellcasting',
      headerText: flattenEntries(raw.headerEntries),
      lists,
    }
  })
}

function parseInitiativeBonus(raw: RawMonster, dexMod: number, crNumeric: number | undefined): number {
  const init = raw.initiative
  if (typeof init === 'number') return init
  if (init && typeof init === 'object') {
    if (typeof init.initiative === 'number') return init.initiative
    if (typeof init.proficiency === 'number') return dexMod + init.proficiency * proficiencyByCr(crNumeric)
  }
  return dexMod
}

export function parseMonster(raw: RawMonster): Statblock {
  const source = raw.source ?? 'UNK'
  const abilities: AbilityScores = {
    str: raw.str ?? 10,
    dex: raw.dex ?? 10,
    con: raw.con ?? 10,
    int: raw.int ?? 10,
    wis: raw.wis ?? 10,
    cha: raw.cha ?? 10,
  }
  const { cr, crNumeric } = parseCr(raw.cr)
  const { type, typeTags } = parseType(raw.type)
  const { ac, acFrom } = parseAc(raw.ac)

  const saves: Partial<Record<Ability, number>> = {}
  for (const [key, value] of Object.entries(raw.save ?? {})) {
    if (key in abilities) saves[key as Ability] = parseBonus(value)
  }

  const skills: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw.skill ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') skills[key] = parseBonus(value)
  }

  const damageImmune = parseDamageList(raw.immune)
  const conditionImmune = parseDamageList(raw.conditionImmune)

  // gear entries are plain "name|source" references, not {@item} tags
  const gear = (raw.gear ?? []).map((g) => {
    const ref = typeof g === 'string' ? g : (g.item ?? '')
    const name = ref.split('|')[0].replace(/\b\w/g, (c) => c.toUpperCase())
    const quantity = typeof g === 'object' && g.quantity && g.quantity > 1 ? ` (${g.quantity})` : ''
    return name + quantity
  })

  const legendary = parseNamedBlocks(raw.legendary)

  return {
    id: slugId(raw.name, source),
    name: raw.name,
    source,
    page: raw.page,
    size: raw.size ?? [],
    type,
    typeTags,
    alignment: parseAlignment(raw.alignment),
    ac,
    acFrom,
    hp: {
      average: raw.hp?.average ?? 0,
      formula: raw.hp?.formula,
      special: raw.hp?.special,
    },
    speed: parseSpeed(raw.speed),
    abilities,
    saves,
    skills,
    senses: raw.senses ?? [],
    passivePerception: typeof raw.passive === 'number' ? raw.passive : undefined,
    languages: raw.languages ?? [],
    cr,
    crNumeric,
    initiativeBonus: parseInitiativeBonus(raw, abilityMod(abilities.dex), crNumeric),
    // 2024 layout: damage and condition immunities share one line
    immunities: [damageImmune, conditionImmune].filter(Boolean).join('; ') || undefined,
    resistances: parseDamageList(raw.resist),
    vulnerabilities: parseDamageList(raw.vulnerable),
    gear,
    traits: parseNamedBlocks(raw.trait),
    actions: parseNamedBlocks(raw.action),
    bonusActions: parseNamedBlocks(raw.bonus),
    reactions: parseNamedBlocks(raw.reaction),
    legendary,
    legendaryActions: raw.legendaryActions ?? (legendary.length ? 3 : undefined),
    legendaryHeader: raw.legendaryHeader ? flattenEntries(raw.legendaryHeader) : undefined,
    lair: [],
    spellcasting: parseSpellcasting(raw.spellcasting),
  }
}

// ---------- spell ----------

const SCHOOLS: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
}

interface RawSpell {
  name: string
  source?: string
  page?: number
  level?: number
  school?: string
  time?: { number?: number; unit?: string; condition?: string }[]
  range?: { type?: string; distance?: { type?: string; amount?: number } }
  components?: { v?: boolean; s?: boolean; m?: boolean | string | { text?: string } }
  duration?: {
    type?: string
    duration?: { type?: string; amount?: number }
    concentration?: boolean
    ends?: string[]
  }[]
  meta?: { ritual?: boolean }
  entries?: RawEntry[]
  entriesHigherLevel?: { entries?: RawEntry[] }[]
}

const TIME_UNITS: Record<string, string> = {
  action: 'Action',
  bonus: 'Bonus Action',
  reaction: 'Reaction',
  minute: 'Minute',
  hour: 'Hour',
  round: 'Round',
}

function parseCastingTime(time: RawSpell['time']): string {
  const t = time?.[0]
  if (!t) return ''
  const unit = TIME_UNITS[t.unit ?? ''] ?? t.unit ?? ''
  const n = t.number ?? 1
  const label = `${n} ${unit}${n > 1 ? 's' : ''}`
  return t.condition ? `${label}, ${t.condition}` : label
}

function parseRange(range: RawSpell['range']): string {
  if (!range) return ''
  const dist = range.distance
  const amount = dist?.amount
  switch (dist?.type) {
    case 'self':
      break
    case 'touch':
      return 'Touch'
    case 'sight':
      return 'Sight'
    case 'unlimited':
      return 'Unlimited'
    case 'feet':
    case 'miles':
      if (range.type === 'point') return `${amount} ${dist.type === 'feet' ? 'feet' : amount === 1 ? 'mile' : 'miles'}`
      break
    default:
      return 'Special'
  }
  if (range.type === 'point') return 'Self'
  // area shapes are self-ranged: "Self (60-foot Cone)"
  const shape = (range.type ?? '').replace(/^./, (c) => c.toUpperCase())
  const unit = dist?.type === 'miles' ? 'mile' : 'foot'
  return `Self (${amount}-${unit} ${shape})`
}

function parseComponents(components: RawSpell['components']): string {
  if (!components) return 'None'
  const parts: string[] = []
  if (components.v) parts.push('V')
  if (components.s) parts.push('S')
  if (components.m !== undefined && components.m !== false) {
    if (components.m === true) parts.push('M')
    else if (typeof components.m === 'string') parts.push(`M (${components.m})`)
    else parts.push(`M (${components.m.text ?? ''})`)
  }
  return parts.join(', ') || 'None'
}

function parseDuration(duration: RawSpell['duration']): { text: string; concentration: boolean } {
  const d = duration?.[0]
  if (!d) return { text: '', concentration: false }
  const concentration = d.concentration ?? false
  switch (d.type) {
    case 'instant':
      return { text: 'Instantaneous', concentration }
    case 'permanent':
      return { text: d.ends?.length ? 'Until dispelled' : 'Permanent', concentration }
    case 'special':
      return { text: 'Special', concentration }
    case 'timed': {
      const amount = d.duration?.amount ?? 0
      const unit = `${d.duration?.type ?? ''}${amount !== 1 ? 's' : ''}`
      const text = concentration ? `Concentration, up to ${amount} ${unit}` : `${amount} ${unit}`
      return { text, concentration }
    }
    default:
      return { text: d.type ?? '', concentration }
  }
}

export function parseSpell(raw: RawSpell): Spell {
  const source = raw.source ?? 'UNK'
  const { text: duration, concentration } = parseDuration(raw.duration)
  return {
    id: slugId(raw.name, source),
    name: raw.name,
    source,
    page: raw.page,
    level: raw.level ?? 0,
    school: SCHOOLS[raw.school ?? ''] ?? raw.school ?? '',
    castingTime: parseCastingTime(raw.time),
    range: parseRange(raw.range),
    components: parseComponents(raw.components),
    duration,
    concentration,
    ritual: raw.meta?.ritual ?? false,
    text: flattenEntries(raw.entries),
    higherLevel: flattenEntries(raw.entriesHigherLevel?.flatMap((h) => h.entries ?? [])),
  }
}

// ---------- item ----------

const ITEM_TYPES: Record<string, string> = {
  A: 'Ammunition',
  AF: 'Ammunition',
  AT: "Artisan's Tools",
  FD: 'Food & Drink',
  G: 'Adventuring Gear',
  GS: 'Gaming Set',
  HA: 'Heavy Armor',
  INS: 'Musical Instrument',
  LA: 'Light Armor',
  M: 'Melee Weapon',
  MA: 'Medium Armor',
  MNT: 'Mount',
  P: 'Potion',
  R: 'Ranged Weapon',
  RD: 'Rod',
  RG: 'Ring',
  S: 'Shield',
  SC: 'Scroll',
  SCF: 'Spellcasting Focus',
  SHP: 'Ship',
  T: 'Tools',
  TAH: 'Tack & Harness',
  TG: 'Trade Good',
  VEH: 'Vehicle',
  WD: 'Wand',
  '$': 'Treasure',
  '$C': 'Currency',
  '$G': 'Gemstone',
}

const WEAPON_PROPERTIES: Record<string, string> = {
  A: 'Ammunition',
  F: 'Finesse',
  H: 'Heavy',
  L: 'Light',
  LD: 'Loading',
  R: 'Reach',
  T: 'Thrown',
  '2H': 'Two-Handed',
  V: 'Versatile',
  S: 'Special',
}

const DAMAGE_TYPES: Record<string, string> = {
  A: 'Acid',
  B: 'Bludgeoning',
  C: 'Cold',
  F: 'Fire',
  FO: 'Force',
  L: 'Lightning',
  N: 'Necrotic',
  P: 'Piercing',
  PS: 'Psychic',
  R: 'Radiant',
  S: 'Slashing',
  T: 'Thunder',
}

interface RawItem {
  name: string
  source?: string
  page?: number
  type?: string | null
  wondrous?: boolean
  staff?: boolean
  rarity?: string
  reqAttune?: boolean | string
  weight?: number
  value?: number
  entries?: RawEntry[]
  // base-item fields
  weaponCategory?: string
  dmg1?: string
  dmg2?: string
  dmgType?: string
  property?: (string | { uid?: string })[]
  ac?: number
}

function itemTypeName(raw: RawItem): string {
  if (raw.wondrous) return 'Wondrous Item'
  if (raw.staff) return 'Staff'
  const code = raw.type?.split('|')[0]
  if (!code) return 'Item'
  return ITEM_TYPES[code] ?? code
}

/** Derived stat line for base weapons/armor, e.g. "1d8 Slashing — Versatile (1d10)". */
function baseItemStatLine(raw: RawItem): string | undefined {
  const parts: string[] = []
  if (raw.dmg1) parts.push(`${raw.dmg1} ${DAMAGE_TYPES[raw.dmgType ?? ''] ?? raw.dmgType ?? ''}`.trim())
  if (raw.ac) parts.push(`AC ${raw.ac}`)
  const props = (raw.property ?? [])
    .map((p) => {
      const uid = typeof p === 'string' ? p : (p.uid ?? '')
      const code = uid.split('|')[0]
      const label = WEAPON_PROPERTIES[code] ?? code
      return code === 'V' && raw.dmg2 ? `${label} (${raw.dmg2})` : label
    })
    .filter(Boolean)
  if (props.length) parts.push(props.join(', '))
  return parts.length ? parts.join(' — ') : undefined
}

export function parseItem(raw: RawItem): Item {
  const source = raw.source ?? 'UNK'
  const text = flattenEntries(raw.entries)
  const statLine = baseItemStatLine(raw)
  if (statLine) text.unshift(statLine)
  return {
    id: slugId(raw.name, source),
    name: raw.name,
    source,
    page: raw.page,
    typeName: itemTypeName(raw),
    rarity: raw.rarity && raw.rarity !== 'none' ? raw.rarity : undefined,
    attunement:
      raw.reqAttune === true
        ? 'Requires Attunement'
        : typeof raw.reqAttune === 'string'
          ? `Requires Attunement ${raw.reqAttune}`
          : undefined,
    weight: raw.weight,
    valueCp: raw.value,
    text,
  }
}

// ---------- rule (rules glossary) ----------

interface RawRule {
  name: string
  source?: string
  page?: number
  entries?: RawEntry[]
}

export function parseRule(raw: RawRule): Rule {
  const source = raw.source ?? 'UNK'
  return {
    id: slugId(raw.name, source),
    name: raw.name,
    source,
    page: raw.page,
    text: flattenEntries(raw.entries),
  }
}
