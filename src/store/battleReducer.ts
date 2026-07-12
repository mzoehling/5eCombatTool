// Pure battle-state reducer. Every mutation of tracker state flows through
// this single serializable path — a requirement for the future Player View
// snapshot broadcaster (see the local feature doc).

import type { Battle, Combatant, ConditionInstance, Group } from '../types'

export interface BattleState {
  combatants: Combatant[]
  battle: Battle
  /** Conditions that expired at the most recent turn change (for a UI notice). */
  expiredConditions: { combatantName: string; condition: string }[]
  /** Turn-start automation and concentration notices (for a UI toast + log). */
  turnEvents: string[]
}

export const initialBattle: Battle = {
  id: 'current',
  round: 1,
  activeCombatantId: null,
  isRunning: false,
  groups: [],
}

export const initialState: BattleState = {
  combatants: [],
  battle: initialBattle,
  expiredConditions: [],
  turnEvents: [],
}

export type BattleAction =
  | { type: 'hydrate'; combatants: Combatant[]; battle: Battle }
  | { type: 'addCombatant'; combatant: Combatant }
  | { type: 'removeCombatants'; ids: string[] }
  | { type: 'updateCombatant'; id: string; patch: Partial<Combatant> }
  | { type: 'applyDamage'; ids: string[]; amount: number }
  | { type: 'applyHealing'; ids: string[]; amount: number }
  | { type: 'setInitiative'; id: string; initiative: number | null }
  | { type: 'rollInitiative'; ids: string[]; rolls: number[] }
  | { type: 'reorder'; id: string; beforeId: string | null }
  /** `dice` is a pool of pre-rolled d6 values consumed by recharge checks (reducer stays pure). */
  | { type: 'startBattle'; dice?: number[] }
  | { type: 'endBattle' }
  | { type: 'nextTurn'; dice?: number[] }
  | { type: 'prevTurn' }
  | { type: 'addGroup'; group: Group }
  | { type: 'removeGroup'; id: string }
  | { type: 'setGroupInBattle'; id: string; inBattle: boolean }
  | { type: 'updateGroup'; id: string; patch: Partial<Omit<Group, 'id'>> }
  | { type: 'assignGroup'; combatantId: string; groupId?: string }
  /** Load a saved encounter: replace the tracker, or merge into it ("add party"). */
  | { type: 'loadEncounter'; name: string; combatants: Combatant[]; groups: Group[]; mode: 'replace' | 'add' }
  | { type: 'setCondition'; id: string; condition: ConditionInstance }
  | { type: 'removeCondition'; id: string; condition: string }
  | { type: 'consumeLimit'; id: string; limitId: string; delta: number }
  | { type: 'clearExpiredNotice' }

/** Initiative desc; ties by sortIndex asc; unrolled (null) last. */
export function sortedCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (a.initiative === null && b.initiative === null) return a.sortIndex - b.sortIndex
    if (a.initiative === null) return 1
    if (b.initiative === null) return -1
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    return a.sortIndex - b.sortIndex
  })
}

function groupInBattle(state: BattleState, c: Combatant): boolean {
  if (!c.groupId) return true
  const group = state.battle.groups.find((g) => g.id === c.groupId)
  return group?.inBattle ?? true
}

/** Combatants that take part in the running battle, in turn order. */
export function turnOrder(state: BattleState): Combatant[] {
  return sortedCombatants(state.combatants).filter((c) => c.isActive && groupInBattle(state, c))
}

function updateOne(combatants: Combatant[], id: string, fn: (c: Combatant) => Combatant): Combatant[] {
  return combatants.map((c) => (c.id === id ? fn(c) : c))
}

function damageOne(c: Combatant, amount: number): Combatant {
  const fromTemp = Math.min(c.tempHp, amount)
  const rest = amount - fromTemp
  return { ...c, tempHp: c.tempHp - fromTemp, hp: Math.max(0, c.hp - rest) }
}

function healOne(c: Combatant, amount: number): Combatant {
  return { ...c, hp: Math.min(c.maxHp, c.hp + amount) }
}

/** Decrements round-based condition durations at the creature's turn start. */
function tickConditions(state: BattleState, combatantId: string): BattleState {
  const expired: BattleState['expiredConditions'] = []
  const combatants = updateOne(state.combatants, combatantId, (c) => {
    const conditions: ConditionInstance[] = []
    for (const cond of c.conditions) {
      if (cond.remainingRounds === undefined) {
        conditions.push(cond)
      } else if (cond.remainingRounds <= 1) {
        expired.push({ combatantName: c.name, condition: cond.condition })
      } else {
        conditions.push({ ...cond, remainingRounds: cond.remainingRounds - 1 })
      }
    }
    return { ...c, conditions }
  })
  return { ...state, combatants, expiredConditions: expired }
}

const RECHARGE_RULE = /^recharge:(\d)$/

/**
 * Turn-start bookkeeping for the newly active creature: condition durations
 * tick, spent legendary actions reset, and recharge abilities roll a d6 from
 * the supplied pool. Events are collected for the toast and combat log.
 */
function applyTurnStart(state: BattleState, combatantId: string, dice: number[]): BattleState {
  const ticked = tickConditions(state, combatantId)
  const events: string[] = []
  const pool = [...dice]
  const combatants = updateOne(ticked.combatants, combatantId, (c) => {
    if (!c.limits.some((l) => l.used > 0)) return c
    const limits = c.limits.map((l) => {
      if (l.used <= 0) return l
      if (l.rechargeRule === 'turn') {
        events.push(`${c.name}: ${l.name} reset (${l.max}/${l.max})`)
        return { ...l, used: 0 }
      }
      const rule = l.rechargeRule?.match(RECHARGE_RULE)
      if (rule) {
        const roll = pool.shift()
        if (roll === undefined) return l
        if (roll >= Number(rule[1])) {
          events.push(`${c.name}: ${l.name} recharged (rolled ${roll})`)
          return { ...l, used: 0 }
        }
        events.push(`${c.name}: ${l.name} did not recharge (rolled ${roll})`)
      }
      return l
    })
    return { ...c, limits }
  })
  return { ...ticked, combatants, turnEvents: events }
}

function advanceTurn(state: BattleState, direction: 1 | -1, dice: number[]): BattleState {
  const order = turnOrder(state)
  if (!order.length) return state
  const currentIndex = order.findIndex((c) => c.id === state.battle.activeCombatantId)
  let round = state.battle.round
  let nextIndex: number
  if (currentIndex === -1) {
    nextIndex = 0
  } else {
    nextIndex = currentIndex + direction
    if (nextIndex >= order.length) {
      nextIndex = 0
      round += 1
    } else if (nextIndex < 0) {
      nextIndex = order.length - 1
      round = Math.max(1, round - 1)
    }
  }
  const active = order[nextIndex]
  const next: BattleState = {
    ...state,
    battle: { ...state.battle, round, activeCombatantId: active.id },
    expiredConditions: [],
    turnEvents: [],
  }
  // durations tick and abilities recharge only when a turn starts going forward
  return direction === 1 ? applyTurnStart(next, active.id, dice) : next
}

let sortCounter = 0

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, combatants: action.combatants, battle: action.battle }

    case 'addCombatant': {
      const maxSort = Math.max(0, ...state.combatants.map((c) => c.sortIndex + 1))
      const combatant = { ...action.combatant, sortIndex: action.combatant.sortIndex || maxSort + ++sortCounter }
      return { ...state, combatants: [...state.combatants, combatant] }
    }

    case 'removeCombatants': {
      const ids = new Set(action.ids)
      const battle =
        state.battle.activeCombatantId && ids.has(state.battle.activeCombatantId)
          ? { ...state.battle, activeCombatantId: null }
          : state.battle
      return { ...state, battle, combatants: state.combatants.filter((c) => !ids.has(c.id)) }
    }

    case 'updateCombatant':
      return { ...state, combatants: updateOne(state.combatants, action.id, (c) => ({ ...c, ...action.patch })) }

    case 'applyDamage': {
      const ids = new Set(action.ids)
      const events: string[] = []
      const combatants = state.combatants.map((c) => {
        if (!ids.has(c.id)) return c
        if (action.amount > 0 && c.conditions.some((x) => x.condition === 'Concentration')) {
          const dc = Math.max(10, Math.floor(action.amount / 2))
          events.push(`${c.name} is concentrating — DC ${dc} Constitution save`)
        }
        return damageOne(c, action.amount)
      })
      return { ...state, combatants, ...(events.length && { turnEvents: events }) }
    }

    case 'applyHealing': {
      const ids = new Set(action.ids)
      return {
        ...state,
        combatants: state.combatants.map((c) => (ids.has(c.id) ? healOne(c, action.amount) : c)),
      }
    }

    case 'setInitiative':
      return {
        ...state,
        combatants: updateOne(state.combatants, action.id, (c) => ({ ...c, initiative: action.initiative })),
      }

    case 'rollInitiative': {
      const rollFor = new Map(action.ids.map((id, i) => [id, action.rolls[i]]))
      return {
        ...state,
        combatants: state.combatants.map((c) => {
          const roll = rollFor.get(c.id)
          return roll === undefined ? c : { ...c, initiative: roll + c.initiativeBonus }
        }),
      }
    }

    case 'reorder': {
      // Move `id` directly before `beforeId` (or to the end of its tie bracket
      // when null) by rewriting sortIndex over the full sorted order.
      const order = sortedCombatants(state.combatants).filter((c) => c.id !== action.id)
      const moved = state.combatants.find((c) => c.id === action.id)
      if (!moved) return state
      const insertAt = action.beforeId === null ? order.length : order.findIndex((c) => c.id === action.beforeId)
      if (insertAt === -1) return state
      order.splice(insertAt, 0, moved)
      const sortFor = new Map(order.map((c, i) => [c.id, i]))
      return {
        ...state,
        combatants: state.combatants.map((c) => ({ ...c, sortIndex: sortFor.get(c.id) ?? c.sortIndex })),
      }
    }

    case 'startBattle': {
      const order = turnOrder(state)
      const first = order[0]
      const next: BattleState = {
        ...state,
        battle: { ...state.battle, isRunning: true, round: 1, activeCombatantId: first?.id ?? null },
        expiredConditions: [],
        turnEvents: [],
      }
      return first ? applyTurnStart(next, first.id, action.dice ?? []) : next
    }

    case 'endBattle':
      return {
        ...state,
        battle: { ...state.battle, isRunning: false, round: 1, activeCombatantId: null },
        expiredConditions: [],
        turnEvents: [],
      }

    case 'nextTurn':
      return advanceTurn(state, 1, action.dice ?? [])

    case 'prevTurn':
      return advanceTurn(state, -1, [])

    case 'addGroup':
      return { ...state, battle: { ...state.battle, groups: [...state.battle.groups, action.group] } }

    case 'removeGroup':
      return {
        ...state,
        battle: { ...state.battle, groups: state.battle.groups.filter((g) => g.id !== action.id) },
        combatants: state.combatants.map((c) => (c.groupId === action.id ? { ...c, groupId: undefined } : c)),
      }

    case 'setGroupInBattle':
      return {
        ...state,
        battle: {
          ...state.battle,
          groups: state.battle.groups.map((g) => (g.id === action.id ? { ...g, inBattle: action.inBattle } : g)),
        },
      }

    case 'updateGroup':
      return {
        ...state,
        battle: {
          ...state.battle,
          groups: state.battle.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
        },
      }

    case 'assignGroup':
      return {
        ...state,
        combatants: updateOne(state.combatants, action.combatantId, (c) => ({ ...c, groupId: action.groupId })),
      }

    case 'loadEncounter': {
      if (action.mode === 'replace') {
        return {
          ...state,
          combatants: action.combatants,
          battle: { ...state.battle, groups: action.groups, isRunning: false, round: 1, activeCombatantId: null },
          expiredConditions: [],
          turnEvents: [],
        }
      }
      const maxSort = Math.max(0, ...state.combatants.map((c) => c.sortIndex + 1))
      const added = action.combatants.map((c, i) => ({ ...c, sortIndex: maxSort + i }))
      return {
        ...state,
        combatants: [...state.combatants, ...added],
        battle: { ...state.battle, groups: [...state.battle.groups, ...action.groups] },
      }
    }

    case 'setCondition':
      return {
        ...state,
        combatants: updateOne(state.combatants, action.id, (c) => ({
          ...c,
          conditions: [
            ...c.conditions.filter((x) => x.condition !== action.condition.condition),
            action.condition,
          ],
        })),
      }

    case 'removeCondition':
      return {
        ...state,
        combatants: updateOne(state.combatants, action.id, (c) => ({
          ...c,
          conditions: c.conditions.filter((x) => x.condition !== action.condition),
        })),
      }

    case 'consumeLimit':
      return {
        ...state,
        combatants: updateOne(state.combatants, action.id, (c) => ({
          ...c,
          limits: c.limits.map((l) =>
            l.id === action.limitId ? { ...l, used: Math.min(l.max, Math.max(0, l.used + action.delta)) } : l,
          ),
        })),
      }

    case 'clearExpiredNotice':
      return state.expiredConditions.length || state.turnEvents.length
        ? { ...state, expiredConditions: [], turnEvents: [] }
        : state
  }
}
