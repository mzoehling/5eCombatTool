import { stripPostfix } from './search'
import type { Combatant, Group } from '../types'

/**
 * Rotating palette for automatically created groups. A group exists to be told
 * apart at a glance, so it gets a colour without anyone opening a colour
 * picker; the picker stays for when the DM wants a specific one.
 *
 * Hues are spaced far enough apart to stay distinguishable, and each is legible
 * as a badge tint in both the parchment and the candlelit palette.
 */
export const GROUP_COLORS = [
  '#b4472e', // rust
  '#3f7f6f', // teal
  '#8a6fb0', // violet
  '#c08a2e', // amber
  '#4a72a8', // steel blue
  '#7d8f3a', // olive
  '#a8527e', // plum
  '#5f7d8c', // slate
] as const

/** Next colour for a battle that already has `existing` groups. */
export function nextGroupColor(existing: number): string {
  return GROUP_COLORS[existing % GROUP_COLORS.length]
}

/**
 * A name for a group made out of a selection: the shared base name when the
 * members are the same kind of creature ("Goblin", "Goblin A" → "Goblin"),
 * otherwise a numbered fallback.
 */
export function derivedGroupName(names: string[], existingGroups: Group[]): string {
  const bases = new Set(names.map((n) => stripPostfix(n.trim())).filter(Boolean))
  if (bases.size === 1) {
    const [base] = [...bases]
    if (!existingGroups.some((g) => g.name.toLowerCase() === base.toLowerCase())) return base
  }
  let n = existingGroups.length + 1
  while (existingGroups.some((g) => g.name.toLowerCase() === `group ${n}`)) n += 1
  return `Group ${n}`
}

/**
 * Initiative rolls for a set of combatants, one shared roll per group.
 *
 * Six goblins roll once at a real table, not six times. The reducer adds each
 * combatant's own bonus to the roll it is given, so members of a group can
 * still end up on different values if their bonuses differ — which is what the
 * rules say should happen.
 */
export function groupedInitiativeRolls(
  combatants: Combatant[],
  roll: () => number,
): { ids: string[]; rolls: number[] } {
  const perGroup = new Map<string, number>()
  const ids: string[] = []
  const rolls: number[] = []
  for (const c of combatants) {
    if (!c.groupId) {
      ids.push(c.id)
      rolls.push(roll())
      continue
    }
    let shared = perGroup.get(c.groupId)
    if (shared === undefined) {
      shared = roll()
      perGroup.set(c.groupId, shared)
    }
    ids.push(c.id)
    rolls.push(shared)
  }
  return { ids, rolls }
}

/**
 * Splits an ordered list into runs of consecutive members of the same group, so
 * the tracker can collapse each run into a single row.
 *
 * Runs rather than one entry per group: a group whose members ended up on
 * different initiative values is genuinely in several places in the order, and
 * pretending otherwise would put a row where its turn is not. Combatants with
 * no group, and runs of one, stay as they are.
 */
export function groupRuns<T extends { id: string; groupId?: string }>(
  ordered: T[],
): { groupId: string; members: T[] }[] {
  const runs: { groupId: string; members: T[] }[] = []
  for (const c of ordered) {
    const last = runs[runs.length - 1]
    if (c.groupId && last && last.groupId === c.groupId) last.members.push(c)
    else if (c.groupId) runs.push({ groupId: c.groupId, members: [c] })
    else runs.push({ groupId: '', members: [c] })
  }
  return runs
}

/**
 * Bundles an ordered list by shared base name — "Goblin", "Goblin A" and
 * "Goblin B" become one entry.
 *
 * This is what the Player View collapses by. It deliberately does not use the
 * DM's groups: those are named after encounters ("Goblin Ambush", "Boss Phase
 * 2") and broadcasting them would hand the table the DM's prep. A base name is
 * something the players can already read off the screen.
 */
export function nameRuns<T extends { id: string; name: string }>(
  ordered: T[],
): { label: string; members: T[] }[] {
  const runs: { label: string; members: T[] }[] = []
  for (const c of ordered) {
    const base = stripPostfix(c.name)
    const last = runs[runs.length - 1]
    if (last && last.label === base) last.members.push(c)
    else runs.push({ label: base, members: [c] })
  }
  return runs
}
