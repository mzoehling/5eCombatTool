// Saved-encounter library: snapshot the tracker (combatants + groups) under
// a name, load it back later (replacing the tracker) or merge it into the
// current one — the latter covers the "add my saved party" workflow.

import type { CombatDb } from '../db'
import { db } from '../db'
import { newId } from '../lib/id'
import { stripPostfix, suffixedNames } from '../lib/search'
import type { Combatant, Group, SavedEncounter } from '../types'

/** Saves under `name`; an existing encounter with the same name is overwritten. */
export async function saveEncounter(
  name: string,
  combatants: Combatant[],
  groups: Group[],
  dbi: CombatDb = db,
  now = Date.now(),
): Promise<SavedEncounter> {
  const trimmed = name.trim()
  const existing = (await dbi.encounters.toArray()).find((e) => e.name.toLowerCase() === trimmed.toLowerCase())
  const entry: SavedEncounter = {
    id: existing?.id ?? newId(),
    name: trimmed,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    combatants,
    groups,
  }
  await dbi.encounters.put(entry)
  return entry
}

/**
 * Fresh combatant/group ids (group membership preserved) so an encounter can
 * be loaded any number of times without id collisions.
 */
export function instantiateEncounter(saved: SavedEncounter): { combatants: Combatant[]; groups: Group[] } {
  const groupIdFor = new Map<string, string>()
  const groups = saved.groups.map((g) => {
    const id = newId()
    groupIdFor.set(g.id, id)
    return { ...g, id }
  })
  const combatants = saved.combatants.map((c) => ({
    ...c,
    id: newId(),
    groupId: c.groupId ? groupIdFor.get(c.groupId) : undefined,
  }))
  return { combatants, groups }
}

/**
 * Prepares combatants for merging into a non-empty tracker: NPCs sharing a
 * name get unique suffixes ("Goblin" → "Goblin B"), PCs already present are
 * dropped (a party member exists only once).
 */
export function prepareForAdd(
  combatants: Combatant[],
  existingNames: string[],
): { combatants: Combatant[]; skippedPCs: number } {
  const names = [...existingNames]
  const result: Combatant[] = []
  let skippedPCs = 0
  for (const c of combatants) {
    if (c.isPC && names.some((n) => n.toLowerCase() === c.name.toLowerCase())) {
      skippedPCs++
      continue
    }
    const [unique] = suffixedNames(stripPostfix(c.name), 1, names)
    names.push(unique)
    result.push({ ...c, name: unique })
  }
  return { combatants: result, skippedPCs }
}
