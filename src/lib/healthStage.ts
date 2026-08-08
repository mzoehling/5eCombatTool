/**
 * The health stages, and how a row draws itself at each of them.
 *
 * This lived in `features/playerView/projection.ts` while the players' screen
 * was the only thing that staged health. The DM's tracker now stages it too —
 * the row's tint, the meter's colour and the HP figure all come from the same
 * word — so the thresholds moved here, where both sides can reach them without
 * the tracker importing a feature module. `projection.ts` re-exports the type,
 * because `HealthStatus` is part of the wire format and that is where a reader
 * of the protocol will look for it.
 */
export type HealthStatus = 'Unharmed' | 'Injured' | 'Bloodied' | 'Critical' | 'Down'

/**
 * The stage a creature is at.
 *
 * Half is where the rules put it — "a creature is Bloodied while it has half
 * its Hit Points or fewer remaining" (XPHB p. 362) — so Bloodied and Critical
 * are `<=` boundaries. Injured is anything short of full: a creature that has
 * taken a single point of damage is no longer Unharmed, and the tint should say
 * so. Injured and Critical are this app's vocabulary; there is no 2024 rule for
 * a health display.
 */
export function healthStatus(hp: number, maxHp: number): HealthStatus {
  if (hp <= 0) return 'Down'
  const ratio = hp / Math.max(1, maxHp)
  if (ratio <= 0.25) return 'Critical'
  if (ratio <= 0.5) return 'Bloodied'
  if (ratio < 1) return 'Injured'
  return 'Unharmed'
}

/**
 * The colour a stage is drawn in.
 *
 * Tokens rather than hex: the two palettes (Vellum Daylight, Ink & Ash) carry
 * their own values for each, and a row must never hard-code one theme's idea of
 * danger. Bloodied and Critical share `--danger` deliberately — they are the
 * same warning at two depths, and the depth is what separates them.
 */
export const STAGE_COLOR: Record<HealthStatus, string> = {
  Unharmed: 'var(--ok)',
  Injured: 'var(--warn)',
  Bloodied: 'var(--danger)',
  Critical: 'var(--danger)',
  Down: 'var(--text-dim)',
}

/**
 * How much of the stage colour is mixed into the row's surface, in percent.
 *
 * These are low on purpose. The tint sits behind body text, so it has to read
 * as a state without ever competing with what is written on it — the full-height
 * gradient it replaces was legible only because the text was fighting it. The
 * ramp climbs as health falls (5 → 10 → 14 → 18) so the row gets visibly more
 * urgent, and Down drops back to 6: a dead creature is quiet, not alarming.
 */
export const STAGE_TINT: Record<HealthStatus, number> = {
  Unharmed: 5,
  Injured: 10,
  Bloodied: 14,
  Critical: 18,
  Down: 6,
}
