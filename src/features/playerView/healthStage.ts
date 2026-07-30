import { healthStatus, type HealthStatus, type PlayerParticipant } from './projection'

/**
 * How full the turn rail draws a combatant's health bar, in percent.
 *
 * The bar is staged, not literal: a player watching the rail wants to know
 * roughly how the fight is going, and a bar that tracks every point of damage
 * turns that into arithmetic — and, for monsters, hands out an exact hit point
 * total the DM deliberately withheld (the snapshot only carries a status word).
 *
 * The stages are the status words themselves rather than even fifths. 20%
 * steps would put boundaries at 60% and 40%, straddling the one threshold the
 * rules actually define — "a creature is Bloodied while it has half its Hit
 * Points or fewer remaining" (XPHB p. 362) — so a Bloodied creature could show
 * a bar one notch above half. Tying the stages to the words means the bar and
 * the label can never contradict each other, and the halfway mark is exactly
 * where the rules put it. Nothing else here is official: Injured and Critical
 * are this app's vocabulary, and there is no 2024 rule for a health display.
 */
export const STAGE_PERCENT: Record<HealthStatus, number> = {
  Unharmed: 100,
  Injured: 75,
  Bloodied: 50,
  Critical: 25,
  Down: 0,
}

/**
 * The status word for a participant, whichever health shape it carries.
 *
 * PCs are broadcast with exact hit points, so their bucket is derived here in
 * the viewer with the same function the DM device uses for monsters — the
 * thresholds stay in one place, and no extra field goes on the wire.
 */
export function statusOf(participant: PlayerParticipant): HealthStatus {
  const h = participant.health
  return h.kind === 'npc' ? h.status : healthStatus(h.hp, h.maxHp)
}
