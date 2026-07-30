/**
 * The part of the initiative order that has not acted yet this round.
 *
 * The Player View's list answers one question — how many turns until the round
 * comes back around — so it shows what is still to come rather than everyone.
 * Whoever is acting is excluded: the spotlight above already carries them.
 *
 * With no active participant (the battle has not started, or the id is stale
 * after a reconnect) the whole order stands in: there is no "rest of the
 * round" to show, and an empty list would read as "nobody is left".
 */
export function upNext<T extends { id: string }>(ordered: T[], activeId: string | null): T[] {
  if (activeId === null) return ordered
  const i = ordered.findIndex((p) => p.id === activeId)
  return i === -1 ? ordered : ordered.slice(i + 1)
}
