import type { LimitedUse, Statblock, StatblockEntry } from '../types'

/**
 * Auto-detects limited-use abilities from a statblock: "(X/Day)" names,
 * "{@recharge N}" markers, legendary action budgets, and per-use
 * spellcasting lists. Used when a combatant is created from a statblock.
 */
export function detectLimitedUses(sb: Statblock): LimitedUse[] {
  const limits: LimitedUse[] = []
  let counter = 0
  const nextId = () => `lu-${++counter}`

  const scanEntries = (entries: StatblockEntry[]) => {
    for (const entry of entries) {
      if (!entry.name) continue
      const perDay = entry.name.match(/\((\d+)\/day[^)]*\)/i)
      const recharge = entry.name.match(/\{@recharge(?: (\d))?\}/)
      const cleanName = entry.name
        .replace(/\s*\{@recharge(?: \d)?\}/, '')
        .replace(/\s*\(\d+\/day[^)]*\)/i, '')
        .trim()
      if (perDay) {
        limits.push({ id: nextId(), name: cleanName, max: Number(perDay[1]), used: 0, rechargeRule: 'day' })
      } else if (recharge) {
        limits.push({
          id: nextId(),
          name: cleanName,
          max: 1,
          used: 0,
          rechargeRule: `recharge:${recharge[1] ?? '6'}`,
        })
      }
    }
  }

  scanEntries(sb.traits)
  scanEntries(sb.actions)
  scanEntries(sb.bonusActions)
  scanEntries(sb.reactions)

  if (sb.legendaryActions) {
    limits.push({
      id: nextId(),
      name: 'Legendary Actions',
      max: sb.legendaryActions,
      used: 0,
      rechargeRule: 'turn',
    })
  }

  for (const sc of sb.spellcasting) {
    for (const list of sc.lists) {
      if (!list.uses) continue
      if (list.perSpell || list.spells.length === 1) {
        for (const spell of list.spells) {
          limits.push({
            id: nextId(),
            name: `${stripTags(spell)} (${list.label})`,
            max: list.uses,
            used: 0,
            rechargeRule: 'day',
          })
        }
      } else {
        limits.push({
          id: nextId(),
          name: `${sc.name} (${list.label})`,
          max: list.uses,
          used: 0,
          rechargeRule: 'day',
        })
      }
    }
  }

  return limits
}

/** Reduces "{@spell Fireball|XPHB}" to "Fireball" for limit labels. */
function stripTags(text: string): string {
  return text
    .replace(/\{@\w+ ([^}|]*)(?:\|[^}]*)?\}/g, '$1')
    .replace(/ \(level \d+ version\)/, '')
    .trim()
}
