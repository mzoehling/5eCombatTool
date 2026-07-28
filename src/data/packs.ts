import type { CombatDb } from '../db'
import { db } from '../db'
import { HOMEBREW_PACK_ID, PACK_SECTIONS, type ContentPack } from '../types'

/** Validates an imported content-pack JSON structure; throws a descriptive error if invalid. */
export function validatePack(data: unknown): ContentPack {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Content pack must be a JSON object.')
  }
  const pack = data as Record<string, unknown>
  for (const field of ['packId', 'name', 'version'] as const) {
    if (typeof pack[field] !== 'string' || !pack[field]) {
      throw new Error(`Content pack is missing the "${field}" field.`)
    }
  }
  // The Homebrew pack is authored in the app and holds content that exists
  // nowhere else. Importing over it would destroy that, so the id is refused
  // outright rather than merged — a merge would still be guesswork about which
  // side of a same-id collision the user meant to keep.
  if (pack.packId === HOMEBREW_PACK_ID) {
    throw new Error(`"${HOMEBREW_PACK_ID}" is a reserved pack id. Give this pack a different packId to import it.`)
  }
  for (const section of PACK_SECTIONS) {
    const entries = pack[section]
    if (entries === undefined) continue
    if (!Array.isArray(entries)) throw new Error(`"${section}" must be an array.`)
    entries.forEach((entry, i) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`${section}[${i}] is not an object.`)
      }
      const e = entry as Record<string, unknown>
      if (typeof e.id !== 'string' || typeof e.name !== 'string') {
        throw new Error(`${section}[${i}] is missing "id" or "name".`)
      }
    })
  }
  if (!PACK_SECTIONS.some((section) => pack[section])) {
    throw new Error('Content pack contains no monsters, PCs, spells, or items.')
  }
  return data as unknown as ContentPack
}

/** Imports (or replaces, keyed by packId) a content pack from raw JSON text. */
export async function importPack(json: string, dbi: CombatDb = db): Promise<ContentPack> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  const pack = validatePack(data)
  await dbi.packs.put(pack)
  return pack
}

/** Deletes an imported pack. The Homebrew pack is not removable — its entries are
 *  deleted one at a time through the editor (see data/homebrewPack.ts). */
export async function removePack(packId: string, dbi: CombatDb = db): Promise<void> {
  if (packId === HOMEBREW_PACK_ID) {
    throw new Error('The Homebrew pack cannot be removed.')
  }
  await dbi.packs.delete(packId)
}

export async function listPacks(dbi: CombatDb = db): Promise<ContentPack[]> {
  return dbi.packs.toArray()
}
