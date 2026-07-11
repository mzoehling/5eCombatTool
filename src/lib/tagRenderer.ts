// Renders upstream inline tag markup ({@tag …}) to plain text.
// Nested tags are resolved innermost-first: the pattern only matches tags
// whose body contains no braces, and we loop until nothing matches.

const TAG = /\{@(\w+)(?: ([^{}]*))?\}/g

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const ATKR_MODES: Record<string, string> = { m: 'Melee', r: 'Ranged' }

const ATK_MODES: Record<string, string> = {
  mw: 'Melee Weapon',
  rw: 'Ranged Weapon',
  ms: 'Melee Spell',
  rs: 'Ranged Spell',
  m: 'Melee',
  r: 'Ranged',
  a: 'Area',
  'mw,rw': 'Melee or Ranged Weapon',
  'ms,rs': 'Melee or Ranged Spell',
}

/** Tags of the form {@tag Name|source|displayText} — show displayText if present, else Name. */
const NAME_LINK_TAGS = new Set([
  'spell',
  'item',
  'itemProperty',
  'itemMastery',
  'creature',
  'condition',
  'status',
  'skill',
  'sense',
  'action',
  'hazard',
  'variantrule',
  'feat',
  'background',
  'class',
  'race',
  'object',
  'deity',
  'disease',
  'reward',
  'vehicle',
  'optfeature',
  'table',
  'quickref',
  'card',
  'deck',
  'facility',
])

/** Formatting tags whose (already-resolved) body is kept verbatim. */
const VERBATIM_TAGS = new Set(['b', 'bold', 'i', 'italic', 'u', 'underline', 's', 'strike', 'em', 'note', 'highlight'])

/** Formatting tags of the form {@tag text|params} — keep only the text. */
const STYLED_TAGS = new Set(['style', 'font', 'color'])

function formatSigned(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('+') || trimmed.startsWith('-') ? trimmed : `+${trimmed}`
}

function attackLabel(modes: string, map: Record<string, string>, suffix: string): string {
  const key = modes.replace(/\s/g, '')
  const parts =
    map[key] ??
    key
      .split(',')
      .map((m) => map[m] ?? m)
      .join(' or ')
  return `${parts} ${suffix}:`
}

function renderTag(tag: string, body: string): string {
  const parts = body.split('|')
  switch (tag) {
    // --- 2024 action markup ---
    case 'atkr':
      return attackLabel(parts[0], ATKR_MODES, 'Attack Roll')
    case 'atk': // 2014-era variant
      return attackLabel(parts[0], ATK_MODES, 'Attack')
    case 'actSave':
      return `${ABILITY_NAMES[parts[0]] ?? parts[0]} Saving Throw:`
    case 'actSaveFail':
      return 'Failure:'
    case 'actSaveFailBy':
      return `Failure by ${parts[0]} or More:`
    case 'actSaveSuccess':
      return 'Success:'
    case 'actSaveSuccessOrFail':
      return 'Failure or Success:'
    case 'actTrigger':
      return 'Trigger:'
    case 'actResponse':
      return parts[0]?.includes('d') ? 'Response—' : 'Response:'
    case 'h':
      return 'Hit: '
    case 'hom':
      return 'Hit or Miss: '
    case 'hit':
      return formatSigned(parts[0])
    case 'dc':
      return `DC ${parts[0]}`
    case 'recharge':
      return parts[0] ? `(Recharge ${parts[0]}–6)` : '(Recharge 6)'

    // --- dice ---
    case 'damage':
    case 'dice':
    case 'autodice':
    case 'd20':
      return parts[1] ?? parts[0]
    case 'scaledice':
    case 'scaledamage':
      return parts[2] ?? parts[parts.length - 1]
    case 'chance':
      return `${parts[0]} percent`

    default:
      if (NAME_LINK_TAGS.has(tag)) return parts[2] || parts[0]
      if (VERBATIM_TAGS.has(tag)) return body
      if (STYLED_TAGS.has(tag)) return parts[0] ?? ''
      // Unknown tag: best-effort — first pipe segment of the body, or nothing.
      return parts[0] ?? ''
  }
}

/** Resolve all inline {@…} tags in `text` to plain text. */
export function renderTags(text: string): string {
  let out = text
  for (let guard = 0; guard < 20; guard++) {
    let replaced = false
    out = out.replace(TAG, (_match, tag: string, body: string | undefined) => {
      replaced = true
      return renderTag(tag, body ?? '')
    })
    if (!replaced) break
  }
  return out
}
