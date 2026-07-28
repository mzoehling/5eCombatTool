import type { CombatDb } from '../db'
import { db } from '../db'
import {
  HOMEBREW_PACK_ID,
  HOMEBREW_PACK_NAME,
  type ContentPack,
  type CreatureSection,
  type Statblock,
} from '../types'

/*
 * Homebrew is stored as the reserved "Homebrew" content pack (packId
 * HOMEBREW_PACK_ID). There is no migration from the pre-v4 `homebrew` table —
 * database v4 drops it and reads nothing, so a database predating the pack
 * starts blank. That is deliberate: a migration path is machinery to maintain
 * and a failure mode that can leave Dexie unable to open the database at all.
 */

/** An empty Homebrew pack, used before the user has authored anything. */
function emptyPack(): ContentPack {
  return { packId: HOMEBREW_PACK_ID, name: HOMEBREW_PACK_NAME, version: '1', monsters: [], pcs: [] }
}

/**
 * Merges homebrew entries into a pack, replacing same-id entries rather than
 * duplicating them. Shared by the editor's save path and by backup import,
 * which must never drop content the user already has.
 */
export function mergeHomebrew(pack: ContentPack, section: CreatureSection, incoming: Statblock[]): ContentPack {
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
    const next = update(pack)
    // Deleting the last entry removes the row rather than leaving an empty
    // husk, so "no homebrew yet" is one state reached one way — whether the
    // user has never authored anything or has just cleared it out.
    if (!next.monsters?.length && !next.pcs?.length) {
      await dbi.packs.delete(HOMEBREW_PACK_ID)
      return
    }
    await dbi.packs.put(next)
  })
}

/**
 * Adds a homebrew entry, or replaces the one with the same id.
 *
 * `removeFrom` names the section the entry is leaving when the user changes its
 * kind. The move and the write are one transaction: two of them would leave the
 * entry moved but stale if the second failed.
 */
export async function saveHomebrewEntry(
  args: { section: CreatureSection; statblock: Statblock; removeFrom?: CreatureSection },
  dbi: CombatDb = db,
): Promise<void> {
  const { section, statblock, removeFrom } = args
  await updateHomebrewPack(dbi, (pack) => {
    const merged = mergeHomebrew(pack, section, [statblock])
    if (!removeFrom || removeFrom === section) return merged
    return { ...merged, [removeFrom]: (merged[removeFrom] ?? []).filter((sb) => sb.id !== statblock.id) }
  })
}

export async function deleteHomebrewEntry(
  section: CreatureSection,
  id: string,
  dbi: CombatDb = db,
): Promise<void> {
  await updateHomebrewPack(dbi, (pack) => ({
    ...pack,
    [section]: (pack[section] ?? []).filter((sb) => sb.id !== id),
    version: String(Date.now()),
  }))
}

/**
 * The Homebrew pack rewritten as an importable content pack.
 *
 * The packId has to change: `homebrew` is reserved, so a file carrying it would
 * be refused on import — including by the person you shared it with, whose own
 * Homebrew pack it must not become. Empty sections are dropped so the result
 * reads like a pack the build script would produce.
 *
 * Returns undefined for an empty pack: with both sections dropped the result
 * would be a pack the pack validator refuses, so there is nothing to share.
 */
export function homebrewAsShareablePack(pack: ContentPack, now = new Date()): ContentPack | undefined {
  if (!pack.monsters?.length && !pack.pcs?.length) return undefined
  const date = now.toISOString().slice(0, 10)
  const shared: ContentPack = {
    packId: `homebrew-${date}`,
    name: `Homebrew (${date})`,
    version: pack.version,
  }
  if (pack.monsters?.length) shared.monsters = pack.monsters
  if (pack.pcs?.length) shared.pcs = pack.pcs
  return shared
}

/** How much the user has authored. Drives the backup reminder. */
export async function homebrewCount(dbi: CombatDb = db): Promise<number> {
  const pack = await dbi.packs.get(HOMEBREW_PACK_ID)
  if (!pack) return 0
  return (pack.monsters?.length ?? 0) + (pack.pcs?.length ?? 0)
}
