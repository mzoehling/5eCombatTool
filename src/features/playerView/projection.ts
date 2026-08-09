// Projects the full battle state into the player-safe snapshot that leaves
// the DM device. Filtering happens here, by projection — AC, exact non-PC HP,
// initiative values, statblocks, limits, groups, and hidden or inactive
// combatants are never part of a snapshot.

import { healthStatus, type HealthStatus } from '../../lib/healthStage'
import { turnOrder, type BattleState } from '../../store/battleReducer'

// Both live in `lib/healthStage.ts` now that the DM's rows stage health the
// same way, and are re-exported here because they are part of the wire format:
// a reader of the protocol looks for the status words beside the snapshot.
export type { HealthStatus }
export { healthStatus }

export interface PlayerCondition {
  condition: string
  remainingRounds?: number
  /** Exhaustion level. */
  level?: number
}

export type PlayerHealth =
  | { kind: 'pc'; hp: number; maxHp: number; tempHp: number }
  | { kind: 'npc'; status: HealthStatus }

export interface PlayerParticipant {
  id: string
  name: string
  isPC: boolean
  health: PlayerHealth
  conditions: PlayerCondition[]
}

export interface PlayerSnapshot {
  round: number
  isRunning: boolean
  activeId: string | null
  /** In initiative order; the order itself is transmitted, the values are not. */
  participants: PlayerParticipant[]
}

/**
 * Wire protocol version.
 *
 * Bump this whenever the shape of `PlayerSnapshot` changes in a way an older
 * viewer would misread — a field removed or renamed, a meaning changed. Adding
 * a field an old viewer simply ignores does not need a bump.
 *
 * The two ends update independently: the DM's iPad deploys, the player's phone
 * is a home-screen bookmark that may sit on a precached build for weeks. When
 * they disagree the viewer has to say so, because the failure it would show
 * otherwise is a battle that quietly renders wrong.
 */
export const PROTOCOL_VERSION = 1

/** Message envelope, versioned for forward compatibility. */
export interface SnapshotMessage {
  v: number
  type: 'snapshot'
  payload: PlayerSnapshot
}

/**
 * A liveness beat and a goodbye.
 *
 * `ping` exists because a dead WebRTC data channel does not always announce
 * itself — an iPad that slept or a PWA the system suspended leaves the viewer
 * holding a channel that will never deliver again, and without a beat to miss
 * the viewer has no way to tell that from a quiet battle.
 *
 * `bye` exists because ending the session used to look exactly like losing it.
 *
 * Neither carries a payload, which is why both are read without regard to the
 * protocol version: there is no shape a mismatched build could misread, and a
 * player whose phone is a release behind still has to learn that the DM closed
 * the table.
 */
export interface ControlMessage {
  v: number
  type: 'ping' | 'bye'
}

export type OutgoingMessage = SnapshotMessage | ControlMessage

/**
 * What arrived on the wire.
 *
 * `mismatch` is kept apart from `ignore` on purpose: an unreadable message is
 * noise to be dropped, but a snapshot the viewer is too old (or too new) to
 * read is something a player must be told about rather than left staring at a
 * screen that never updates.
 */
export type IncomingMessage =
  | { kind: 'snapshot'; snapshot: PlayerSnapshot }
  | { kind: 'mismatch'; theirs: number; ours: number }
  | { kind: 'ping' }
  | { kind: 'bye' }
  | { kind: 'ignore' }

export function projectSnapshot(state: BattleState): PlayerSnapshot {
  const participants = turnOrder(state)
    .filter((c) => !c.hiddenFromPlayers)
    .map((c): PlayerParticipant => ({
      id: c.id,
      name: c.name,
      isPC: c.isPC,
      // AC is deliberately not transmitted, along with initiative, the
      // statblock and DM notes — see the projection test.
      health: c.isPC
        ? { kind: 'pc', hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp }
        : { kind: 'npc', status: healthStatus(c.hp, c.maxHp) },
      // note is a DM field — never transmitted; unset keys are omitted, not
      // sent as undefined (the WebRTC wire format would turn them into null)
      conditions: c.conditions.map(({ condition, remainingRounds, level }) => ({
        condition,
        ...(remainingRounds !== undefined && { remainingRounds }),
        ...(level !== undefined && { level }),
      })),
    }))

  return {
    round: state.battle.round,
    isRunning: state.battle.isRunning,
    activeId: state.battle.isRunning ? state.battle.activeCombatantId : null,
    participants,
  }
}

export function wrapSnapshot(payload: PlayerSnapshot): SnapshotMessage {
  return { v: PROTOCOL_VERSION, type: 'snapshot', payload }
}

export function controlMessage(type: 'ping' | 'bye'): ControlMessage {
  return { v: PROTOCOL_VERSION, type }
}

/**
 * Classifies an incoming message. A snapshot of another protocol version is
 * reported rather than dropped, so the viewer can name the problem; anything
 * else — the "hello" a late-joining viewer sends, or junk — is ignored.
 */
export function readMessage(data: unknown): IncomingMessage {
  if (typeof data !== 'object' || data === null) return { kind: 'ignore' }
  const msg = data as { v?: unknown; type?: unknown; payload?: unknown }
  // Control messages are read before the version is even looked at — see
  // `ControlMessage` for why they are deliberately version-independent.
  if (msg.type === 'ping') return { kind: 'ping' }
  if (msg.type === 'bye') return { kind: 'bye' }
  if (msg.type !== 'snapshot' || typeof msg.payload !== 'object' || msg.payload === null) return { kind: 'ignore' }
  if (typeof msg.v !== 'number') return { kind: 'ignore' }
  if (msg.v !== PROTOCOL_VERSION) return { kind: 'mismatch', theirs: msg.v, ours: PROTOCOL_VERSION }
  return { kind: 'snapshot', snapshot: msg.payload as PlayerSnapshot }
}

/** Parses an incoming message; null for anything that isn't a readable snapshot. */
export function parseSnapshotMessage(data: unknown): PlayerSnapshot | null {
  const msg = readMessage(data)
  return msg.kind === 'snapshot' ? msg.snapshot : null
}
