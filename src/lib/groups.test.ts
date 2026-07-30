import { describe, expect, it } from 'vitest'
import {
  derivedGroupName,
  groupedInitiativeRolls,
  groupRuns,
  GROUP_COLORS,
  nameRuns,
  nextGroupColor,
} from './groups'
import type { Combatant, Group } from '../types'

const c = (id: string, name: string, groupId?: string, initiativeBonus = 0) =>
  ({ id, name, groupId, initiativeBonus }) as Combatant

const g = (name: string): Group => ({ id: name, name, inBattle: true })

describe('nextGroupColor', () => {
  it('walks the palette and wraps around', () => {
    expect(nextGroupColor(0)).toBe(GROUP_COLORS[0])
    expect(nextGroupColor(1)).toBe(GROUP_COLORS[1])
    expect(nextGroupColor(GROUP_COLORS.length)).toBe(GROUP_COLORS[0])
  })
})

describe('derivedGroupName', () => {
  it('uses the shared base name of the selection', () => {
    expect(derivedGroupName(['Goblin', 'Goblin A', 'Goblin B'], [])).toBe('Goblin')
  })

  it('falls back to a number when the selection is mixed', () => {
    expect(derivedGroupName(['Goblin', 'Wolf'], [])).toBe('Group 1')
  })

  it('falls back rather than colliding with an existing group', () => {
    expect(derivedGroupName(['Goblin', 'Goblin A'], [g('Goblin')])).toBe('Group 2')
  })

  it('skips numbered names that are already taken', () => {
    expect(derivedGroupName(['Goblin', 'Wolf'], [g('Group 1')])).toBe('Group 2')
  })
})

describe('groupedInitiativeRolls', () => {
  it('shares one roll across a group and rolls separately for loners', () => {
    let n = 0
    const rolls = [5, 12, 19]
    const { ids, rolls: out } = groupedInitiativeRolls(
      [c('a', 'Goblin', 'g1'), c('b', 'Goblin A', 'g1'), c('c', 'Wolf'), c('d', 'Goblin B', 'g1')],
      () => rolls[n++],
    )
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
    // the group draws once (5) even though its members are not adjacent
    expect(out).toEqual([5, 5, 12, 5])
  })

  it('gives each group its own roll', () => {
    let n = 0
    const rolls = [7, 15]
    const { rolls: out } = groupedInitiativeRolls([c('a', 'A', 'g1'), c('b', 'B', 'g2')], () => rolls[n++])
    expect(out).toEqual([7, 15])
  })
})

describe('groupRuns', () => {
  it('bundles consecutive members and leaves loners alone', () => {
    const runs = groupRuns([c('a', 'A', 'g1'), c('b', 'B', 'g1'), c('c', 'C')])
    expect(runs).toHaveLength(2)
    expect(runs[0].members.map((m) => m.id)).toEqual(['a', 'b'])
    expect(runs[1].groupId).toBe('')
  })

  it('keeps a split group as two runs, so a row cannot sit where its turn is not', () => {
    const runs = groupRuns([c('a', 'A', 'g1'), c('x', 'X'), c('b', 'B', 'g1')])
    expect(runs.map((r) => r.members.map((m) => m.id))).toEqual([['a'], ['x'], ['b']])
  })
})

describe('nameRuns', () => {
  it('bundles by base name regardless of the DM groups', () => {
    const runs = nameRuns([c('a', 'Goblin'), c('b', 'Goblin A'), c('c', 'Wolf')])
    expect(runs.map((r) => `${r.label} x${r.members.length}`)).toEqual(['Goblin x2', 'Wolf x1'])
  })
})
