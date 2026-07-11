// Renders upstream inline tag markup ({@tag …}) to plain text, and — for
// the dice-roller integration — to segments that keep rollable dice
// expressions separate from prose (see renderTagSegments).
// Nested tags are resolved innermost-first: the pattern only matches tags
// whose body contains no braces, and we loop until nothing matches.

import { parseDiceExpression } from './diceExpr'

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

// ---------------------------------------------------------------------------
// Segment rendering: prose plus rollable dice, for clickable damage/attack
// links. 5etools tags are authoritative ({@damage}, {@hit}, …); plain text
// (homebrew, untagged packs) falls back to conservative pattern matching.
// ---------------------------------------------------------------------------

export type TagSegment =
  | { kind: 'text'; text: string }
  | { kind: 'dice'; expr: string; display: string }

/** Dice-family tags that become rollable segments. Their bodies never nest. */
const DICE_TAG = /\{@(damage|dice|autodice|scaledice|scaledamage|hit|d20)(?: ([^{}]*))?\}/g

function diceToken(tag: string, body: string): { expr: string; display: string } | null {
  const parts = body.split('|')
  switch (tag) {
    case 'damage':
    case 'dice':
    case 'autodice':
      return { expr: parts[0].trim(), display: parts[1] ?? parts[0] }
    case 'scaledice':
    case 'scaledamage': {
      const display = parts[2] ?? parts[parts.length - 1]
      return { expr: display.trim(), display }
    }
    case 'hit': {
      const signed = formatSigned(parts[0])
      return { expr: `1d20${signed}`, display: signed }
    }
    case 'd20': {
      const signed = formatSigned(parts[0])
      return { expr: `1d20${signed}`, display: parts[1] ?? parts[0] }
    }
    default:
      return null
  }
}

/** Dice in plain prose: needs a die term ("2d6 + 3", "1w8+2", "d10") — bare numbers never match. */
const PLAIN_DICE = /\b\d*[dw]\d+(?:\s*[+-]\s*(?:\d+\s*[dw]\s*\d+|\d*[dw]\d+|\d+))*/gi

function linkifyPlainDice(text: string): TagSegment[] {
  const segments: TagSegment[] = []
  let last = 0
  for (const match of text.matchAll(PLAIN_DICE)) {
    const expr = match[0]
    if (parseDiceExpression(expr) === null) continue
    if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) })
    segments.push({ kind: 'dice', expr, display: expr })
    last = match.index + expr.length
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) })
  return segments
}

/**
 * Resolves tags like renderTags, but returns prose/dice segments. Dice-family
 * tags are extracted first (so their expressions stay exact through nested
 * formatting tags), then remaining plain text is pattern-scanned.
 */
export function renderTagSegments(text: string): TagSegment[] {
  const tokens: { expr: string; display: string }[] = []
  const withSentinels = text.replace(DICE_TAG, (match, tag: string, body: string | undefined) => {
    const token = diceToken(tag, body ?? '')
    if (!token || parseDiceExpression(token.expr) === null) return renderTags(match)
    tokens.push(token)
    return `\u0000${tokens.length - 1}\u0000`
  })
  const resolved = renderTags(withSentinels)

  const segments: TagSegment[] = []
  // NUL is the sentinel — it cannot occur in statblock text
  // eslint-disable-next-line no-control-regex
  resolved.split(/\u0000(\d+)\u0000/).forEach((part, i) => {
    if (i % 2 === 1) {
      const token = tokens[Number(part)]
      segments.push({ kind: 'dice', expr: token.expr, display: token.display })
    } else if (part) {
      segments.push(...linkifyPlainDice(part))
    }
  })
  return segments
}
