import type { CombatDb } from '../db'
import { db } from '../db'
import type { ContentPack } from '../types'

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
  for (const section of ['monsters', 'spells', 'items'] as const) {
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
  if (!pack.monsters && !pack.spells && !pack.items) {
    throw new Error('Content pack contains no monsters, spells, or items.')
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

export async function removePack(packId: string, dbi: CombatDb = db): Promise<void> {
  await dbi.packs.delete(packId)
}

export async function listPacks(dbi: CombatDb = db): Promise<ContentPack[]> {
  return dbi.packs.toArray()
}
