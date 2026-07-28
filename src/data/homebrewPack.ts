import type { CombatDb } from '../db'
import { db } from '../db'
import { HOMEBREW_PACK_ID, HOMEBREW_PACK_NAME, type ContentPack, type Statblock } from '../types'

/** The sections the Homebrew pack can hold today. Spells and items are a
 *  content-pack section already, so extending this is additive. */
export type HomebrewSection = 'monsters' | 'pcs'

/** An empty Homebrew pack, used before the user has authored anything. */
function emptyPack(): ContentPack {
  return { packId: HOMEBREW_PACK_ID, name: HOMEBREW_PACK_NAME, version: '1', monsters: [], pcs: [] }
}

/**
 * Merges homebrew entries into a pack, replacing same-id entries rather than
 * duplicating them. Shared by the editor's save path and by backup import,
 * which must never drop content the user already has.
 */
export function mergeHomebrew(pack: ContentPack, section: HomebrewSection, incoming: Statblock[]): ContentPack {
  const existing = pack[section] ?? []
  const byId = new Map(existing.map((sb) => [sb.id, sb]))
  for (const sb of incoming) byId.set(sb.id, sb)
  return { ...pack, [section]: [...byId.values()], version: String(Date.now()) }
}

/** The Homebrew pack, or an empty one when the user has authored nothing yet —
 *  callers never have to special-case first run. */
export async function getHomebrewPack(dbi: CombatDb = db): Promise<ContentPack> {
  return (await dbi.packs.get(HOMEBREW_PACK_ID)) ?? emptyPack()
}

/**
 * Reads, updates and writes the Homebrew pack in one transaction. Everything
 * the user authors lives in a single row, so an unguarded read-modify-write
 * loses edits whenever two of them overlap — which they do, since the app is a
 * PWA that is routinely open on a tablet and a laptop at the same time.
 */
async function updateHomebrewPack(
  dbi: CombatDb,
  update: (pack: ContentPack) => ContentPack,
): Promise<void> {
  await dbi.transaction('rw', dbi.packs, async () => {
    const pack = (await dbi.packs.get(HOMEBREW_PACK_ID)) ?? emptyPack()
    await dbi.packs.put(update(pack))
  })
}

/** Adds a homebrew entry, or replaces the one with the same id. */
export async function saveHomebrewEntry(
  section: HomebrewSection,
  statblock: Statblock,
  dbi: CombatDb = db,
): Promise<void> {
  await updateHomebrewPack(dbi, (pack) => mergeHomebrew(pack, section, [statblock]))
}

export async function deleteHomebrewEntry(
  section: HomebrewSection,
  id: string,
  dbi: CombatDb = db,
): Promise<void> {
  await updateHomebrewPack(dbi, (pack) => ({
    ...pack,
    [section]: (pack[section] ?? []).filter((sb) => sb.id !== id),
    version: String(Date.now()),
  }))
}

/** Moves an entry between the Monsters and PCs sections — the successor to
 *  editing a homebrew entry's `kind`, which the old editor could not do. */
export async function moveHomebrewEntry(
  from: HomebrewSection,
  to: HomebrewSection,
  id: string,
  dbi: CombatDb = db,
): Promise<void> {
  if (from === to) return
  await updateHomebrewPack(dbi, (pack) => {
    const entry = (pack[from] ?? []).find((sb) => sb.id === id)
    if (!entry) return pack
    const moved = mergeHomebrew(pack, to, [entry])
    return { ...moved, [from]: (moved[from] ?? []).filter((sb) => sb.id !== id) }
  })
}

/** How much the user has authored. Drives the backup reminder. */
export async function homebrewCount(dbi: CombatDb = db): Promise<number> {
  const pack = await dbi.packs.get(HOMEBREW_PACK_ID)
  if (!pack) return 0
  return (pack.monsters?.length ?? 0) + (pack.pcs?.length ?? 0)
}
