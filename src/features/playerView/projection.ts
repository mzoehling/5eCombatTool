// Projects the full battle state into the player-safe snapshot that leaves
// the DM device. Filtering happens here, by projection — AC, exact non-PC HP,
// initiative values, statblocks, limits, groups, and hidden or inactive
// combatants are never part of a snapshot.

import { turnOrder, type BattleState } from '../../store/battleReducer'

export type HealthStatus = 'Unharmed' | 'Injured' | 'Bloodied' | 'Critical' | 'Down'

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

/** Message envelope, versioned for forward compatibility. */
export interface SnapshotMessage {
  v: 1
  type: 'snapshot'
  payload: PlayerSnapshot
}

export function healthStatus(hp: number, maxHp: number): HealthStatus {
  if (hp <= 0) return 'Down'
  const ratio = hp / Math.max(1, maxHp)
  if (ratio <= 0.25) return 'Critical'
  if (ratio <= 0.5) return 'Bloodied'
  if (ratio < 1) return 'Injured'
  return 'Unharmed'
}

export function projectSnapshot(state: BattleState): PlayerSnapshot {
  const participants = turnOrder(state)
    .filter((c) => !c.hiddenFromPlayers)
    .map((c): PlayerParticipant => ({
      id: c.id,
      name: c.name,
      isPC: c.isPC,
      health: c.isPC
        ? { kind: 'pc', hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp }
        : { kind: 'npc', status: healthStatus(c.hp, c.maxHp) },
      // note is a DM field — never transmitted
      conditions: c.conditions.map(({ condition, remainingRounds, level }) => ({
        condition,
        remainingRounds,
        level,
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
  return { v: 1, type: 'snapshot', payload }
}

/** Parses an incoming message; returns null for anything that isn't a v1 snapshot. */
export function parseSnapshotMessage(data: unknown): PlayerSnapshot | null {
  if (typeof data !== 'object' || data === null) return null
  const msg = data as Partial<SnapshotMessage>
  if (msg.v !== 1 || msg.type !== 'snapshot' || typeof msg.payload !== 'object' || msg.payload === null) return null
  return msg.payload
}
