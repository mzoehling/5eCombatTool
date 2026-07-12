// Human-readable combat-log lines derived from dispatched actions. Pure —
// the store appends the results to its log; nothing here mutates state.

import type { BattleAction, BattleState } from './battleReducer'

function nameOf(state: BattleState, id: string): string {
  return state.combatants.find((c) => c.id === id)?.name ?? 'Unknown'
}

function names(state: BattleState, ids: string[]): string {
  return ids.map((id) => nameOf(state, id)).join(', ')
}

function turnMessages(prev: BattleState, next: BattleState): string[] {
  const messages: string[] = []
  if (next.battle.round !== prev.battle.round) messages.push(`Round ${next.battle.round}`)
  if (next.battle.activeCombatantId) {
    messages.push(`${nameOf(next, next.battle.activeCombatantId)}'s turn`)
  }
  for (const e of next.expiredConditions) messages.push(`${e.condition} expired on ${e.combatantName}`)
  messages.push(...next.turnEvents)
  return messages
}

/** Log lines for one action; empty for actions that aren't worth logging. */
export function describeAction(action: BattleAction, prev: BattleState, next: BattleState): string[] {
  switch (action.type) {
    case 'addCombatant':
      return [`${action.combatant.name} added`]
    case 'removeCombatants':
      return [`Removed ${names(prev, action.ids)}`]
    case 'applyDamage': {
      const messages = [`${action.amount} damage → ${names(prev, action.ids)}`]
      // fresh concentration notices only (reference change ⇒ this action set them)
      if (next.turnEvents !== prev.turnEvents) messages.push(...next.turnEvents)
      return messages
    }
    case 'applyHealing':
      return [`${action.amount} healing → ${names(prev, action.ids)}`]
    case 'setInitiative':
      return action.initiative === null ? [] : [`${nameOf(prev, action.id)}: initiative ${action.initiative}`]
    case 'rollInitiative': {
      const parts = action.ids.map((id) => {
        const c = next.combatants.find((x) => x.id === id)
        return c ? `${c.name} ${c.initiative}` : null
      })
      const shown = parts.filter((p) => p !== null)
      return shown.length ? [`Initiative rolled: ${shown.join(', ')}`] : []
    }
    case 'startBattle': {
      const messages = ['Battle started — Round 1']
      if (next.battle.activeCombatantId) messages.push(`${nameOf(next, next.battle.activeCombatantId)}'s turn`)
      for (const e of next.expiredConditions) messages.push(`${e.condition} expired on ${e.combatantName}`)
      messages.push(...next.turnEvents)
      return messages
    }
    case 'endBattle':
      return ['Battle ended']
    case 'nextTurn':
    case 'prevTurn':
      return turnMessages(prev, next)
    case 'setCondition': {
      const target = nameOf(prev, action.id)
      const { condition, remainingRounds, level } = action.condition
      const detail = [
        condition === 'Exhaustion' && level !== undefined ? `level ${level}` : '',
        remainingRounds !== undefined ? `${remainingRounds} rounds` : '',
      ]
        .filter(Boolean)
        .join(', ')
      return [`${target}: ${condition}${detail ? ` (${detail})` : ''}`]
    }
    case 'removeCondition':
      return [`${nameOf(prev, action.id)}: ${action.condition} removed`]
    case 'loadEncounter':
      return [
        action.mode === 'replace'
          ? `Loaded encounter "${action.name}" (${action.combatants.length} combatants)`
          : `Added "${action.name}" to the tracker (${action.combatants.length} combatants)`,
      ]
    case 'consumeLimit': {
      const c = next.combatants.find((x) => x.id === action.id)
      const limit = c?.limits.find((l) => l.id === action.limitId)
      if (!c || !limit) return []
      const left = limit.max - limit.used
      return [`${c.name}: ${limit.name} ${action.delta > 0 ? 'used' : 'restored'} (${left}/${limit.max} left)`]
    }
    case 'updateCombatant': {
      const target = nameOf(prev, action.id)
      const messages: string[] = []
      if (action.patch.hp !== undefined) messages.push(`${target}: HP set to ${action.patch.hp}`)
      if (action.patch.tempHp !== undefined) messages.push(`${target}: temp HP set to ${action.patch.tempHp}`)
      return messages
    }
    default:
      return []
  }
}
