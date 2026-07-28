import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { HOMEBREW_PACK_ID, type ContentPack, type Item, type Rule, type Spell, type Statblock } from '../types'

/**
 * Where an entry came from. PC-ness is deliberately *not* here: a player
 * character is identified by the section it lives in, because packs can carry
 * PCs too and a flag on the entry could not say which pack list it belongs to.
 */
export type Origin = { kind: 'srd' } | { kind: 'pack'; packId: string; packName: string } | { kind: 'homebrew' }

export interface CompendiumEntry<T> {
  entry: T
  origin: Origin
}

/** The two creature sections. An entry from 'pcs' joins the battle as a PC. */
export type CreatureSection = 'monsters' | 'pcs'

/** A creature lookup result. The section travels with it so callers know
 *  whether to add it to the tracker as a PC. */
export interface CreatureHit extends CompendiumEntry<Statblock> {
  section: CreatureSection
}

/** The bundled ruleset. Entries carry the original book code and page, so the
 *  provenance has to be spelled out separately to distinguish the CC-BY subset
 *  from the same passage in a purchased pack. */
export const SRD_LABEL = 'SRD 5.2.1'

const SRD_ORIGIN = { kind: 'srd' } as const

/** The origin for a pack's entries. Homebrew is a pack like any other in
 *  storage, but keeps its own origin kind so its badge stays the compact "HB"
 *  rather than the pack name, and so precedence reads plainly at the call site. */
export function packOrigin(pack: ContentPack): Origin {
  if (pack.packId === HOMEBREW_PACK_ID) return { kind: 'homebrew' }
  return { kind: 'pack', packId: pack.packId, packName: pack.name }
}

/** Compact provenance for a badge next to an entry name. */
export function originBadgeLabel(origin: Origin): string {
  if (origin.kind === 'homebrew') return 'HB'
  if (origin.kind === 'pack') return origin.packName
  return 'SRD'
}

/** The badge's CSS modifier — see `.badge.hb` / `.badge.pack` / `.badge.srd`. */
export function originBadgeClass(origin: Origin): string {
  return origin.kind === 'homebrew' ? 'hb' : origin.kind
}

/** Spelled-out provenance for detail views, which have no badge. */
export function originLabel(origin: Origin): string {
  if (origin.kind === 'homebrew') return 'Homebrew'
  if (origin.kind === 'pack') return origin.packName
  return SRD_LABEL
}

/** A key that stays unique when two packs hold entries with the same id — which
 *  they do, since pack ids come from the same upstream slugs. */
export function entryKey(origin: Origin, id: string): string {
  return `${origin.kind}:${origin.kind === 'pack' ? origin.packId : ''}:${id}`
}

export interface CompendiumData {
  monsters: CompendiumEntry<Statblock>[]
  pcs: CompendiumEntry<Statblock>[]
  spells: CompendiumEntry<Spell>[]
  items: CompendiumEntry<Item>[]
  rules: CompendiumEntry<Rule>[]
}

/**
 * Deduplicate compendium entries by case-insensitive name. Inputs are given
 * highest-precedence-first; the first entry seen for a given name wins and
 * later same-name entries are dropped. Used so an imported pack's variant of a
 * spell/item/monster shadows the bundled SRD copy instead of listing twice.
 */
export function dedupeByName<T extends { name: string }>(
  ...sources: CompendiumEntry<T>[][]
): CompendiumEntry<T>[] {
  const seen = new Set<string>()
  const out: CompendiumEntry<T>[] = []
  for (const source of sources) {
    for (const wrapped of source) {
      const key = wrapped.entry.name.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(wrapped)
    }
  }
  return out
}

/** Puts the Homebrew pack first so it takes precedence over imported packs. */
export function orderPacks(packs: ContentPack[]): ContentPack[] {
  return [...packs].sort(
    (a, b) => Number(b.packId === HOMEBREW_PACK_ID) - Number(a.packId === HOMEBREW_PACK_ID),
  )
}

export interface CompendiumSources {
  /** The bundled SRD tables. */
  monsters: Statblock[]
  spells: Spell[]
  items: Item[]
  rules: Rule[]
  /** Highest precedence first — see orderPacks. */
  packs: ContentPack[]
}

/** Merges the SRD tables with every pack. Kept separate from the hook so the
 *  merge rules can be tested without a DOM or a database. */
export function buildCompendium(src: CompendiumSources): CompendiumData {
  const srdMonsters = src.monsters.map((entry) => ({ entry, origin: SRD_ORIGIN }))
  const srdSpells = src.spells.map((entry) => ({ entry, origin: SRD_ORIGIN }))
  const srdItems = src.items.map((entry) => ({ entry, origin: SRD_ORIGIN }))
  const srdRules = src.rules.map((entry) => ({ entry, origin: SRD_ORIGIN }))

  const packMonsters: CompendiumEntry<Statblock>[] = []
  const packPcs: CompendiumEntry<Statblock>[] = []
  const packSpells: CompendiumEntry<Spell>[] = []
  const packItems: CompendiumEntry<Item>[] = []
  for (const pack of src.packs) {
    const origin = packOrigin(pack)
    packMonsters.push(...(pack.monsters ?? []).map((entry) => ({ entry, origin })))
    packPcs.push(...(pack.pcs ?? []).map((entry) => ({ entry, origin })))
    packSpells.push(...(pack.spells ?? []).map((entry) => ({ entry, origin })))
    packItems.push(...(pack.items ?? []).map((entry) => ({ entry, origin })))
  }

  // Precedence homebrew > pack > SRD: a same-name entry from a higher source
  // shadows the lower one so duplicates are not listed twice.
  //
  // PCs are the deliberate exception — they are not deduped. Two parties can
  // each have a Bob, and hiding one of them would quietly remove a real player
  // character from the list. Shadowing is right for rules content, where the
  // entries are two versions of one thing; it is wrong for identities.
  return {
    monsters: dedupeByName(packMonsters, srdMonsters),
    pcs: packPcs,
    spells: dedupeByName(packSpells, srdSpells),
    items: dedupeByName(packItems, srdItems),
    rules: srdRules,
  }
}

/** Live view over SRD tables + imported packs + homebrew. */
export function useCompendium(): CompendiumData | undefined {
  return useLiveQuery(async (): Promise<CompendiumData> => {
    const [monsters, spells, items, rules, packs] = await Promise.all([
      db.monsters.toArray(),
      db.spells.toArray(),
      db.items.toArray(),
      db.rules.toArray(),
      db.packs.toArray(),
    ])
    return buildCompendium({ monsters, spells, items, rules, packs: orderPacks(packs) })
  })
}

/* The lookups below return the matching entry together with its origin, so the
   reference dialogs can name the provenance the way the browse list's badge
   does. */

/** Case-insensitive spell lookup: imported packs first, then SRD — mirrors the
 *  browse-list precedence (pack overrides SRD) so a tapped link resolves to the
 *  same entry the compendium shows. */
export async function findSpellByName(name: string): Promise<CompendiumEntry<Spell> | undefined> {
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  for (const pack of orderPacks(await db.packs.toArray())) {
    const hit = (pack.spells ?? []).find((s) => s.name.toLowerCase() === lower)
    if (hit) return { entry: hit, origin: packOrigin(pack) }
  }
  const srd = await db.spells.where('name').equalsIgnoreCase(trimmed).first()
  return srd && { entry: srd, origin: SRD_ORIGIN }
}

/** Case-insensitive item lookup: imported packs first, then SRD (see findSpellByName). */
export async function findItemByName(name: string): Promise<CompendiumEntry<Item> | undefined> {
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  for (const pack of orderPacks(await db.packs.toArray())) {
    const hit = (pack.items ?? []).find((i) => i.name.toLowerCase() === lower)
    if (hit) return { entry: hit, origin: packOrigin(pack) }
  }
  const srd = await db.items.where('name').equalsIgnoreCase(trimmed).first()
  return srd && { entry: srd, origin: SRD_ORIGIN }
}

/** Case-insensitive rules-glossary lookup. Rules are SRD-only — ContentPack
 *  carries no rules, so there is no pack path here. */
export async function findRuleByName(name: string): Promise<CompendiumEntry<Rule> | undefined> {
  const srd = await db.rules.where('name').equalsIgnoreCase(name.trim()).first()
  return srd && { entry: srd, origin: SRD_ORIGIN }
}

/**
 * Case-insensitive creature lookup across both creature sections: homebrew,
 * then imported packs, then SRD — mirroring the browse-list precedence so a
 * tapped link resolves to the entry the compendium shows. Within one pack
 * monsters are searched before PCs.
 *
 * The section comes back with the hit because it decides whether the tracker
 * treats the result as a player character.
 */
export async function findMonsterByName(name: string): Promise<CreatureHit | undefined> {
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  for (const pack of orderPacks(await db.packs.toArray())) {
    const origin = packOrigin(pack)
    for (const section of ['monsters', 'pcs'] as const) {
      const hit = (pack[section] ?? []).find((m) => m.name.toLowerCase() === lower)
      if (hit) return { entry: hit, origin, section }
    }
  }
  const srd = await db.monsters.where('name').equalsIgnoreCase(trimmed).first()
  return srd && { entry: srd, origin: SRD_ORIGIN, section: 'monsters' }
}
