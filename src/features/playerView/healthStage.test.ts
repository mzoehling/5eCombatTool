import { describe, expect, it } from 'vitest'
import { STAGE_PERCENT, statusOf } from './healthStage'
import { healthStatus, type PlayerParticipant } from './projection'

const pc = (hp: number, maxHp: number): PlayerParticipant => ({
  id: 'p',
  name: 'PC',
  isPC: true,
  health: { kind: 'pc', hp, maxHp, tempHp: 0 },
  conditions: [],
})

describe('health stages', () => {
  it('puts the Bloodied stage exactly on the rule, half or fewer', () => {
    // XPHB p. 362: "A creature is Bloodied while it has half its Hit Points or
    // fewer remaining." Half must be Bloodied; one point above must not be.
    expect(healthStatus(50, 100)).toBe('Bloodied')
    expect(healthStatus(51, 100)).toBe('Injured')
    expect(STAGE_PERCENT.Bloodied).toBe(50)
  })

  it('descends without repeating a stage', () => {
    const stages = (['Unharmed', 'Injured', 'Bloodied', 'Critical', 'Down'] as const).map((s) => STAGE_PERCENT[s])
    expect(stages).toEqual([...stages].sort((a, b) => b - a))
    expect(new Set(stages).size).toBe(stages.length)
  })

  it('empties the bar only when down', () => {
    expect(STAGE_PERCENT.Down).toBe(0)
    expect(STAGE_PERCENT.Critical).toBeGreaterThan(0)
  })

  it('derives a PC status from exact hit points, as monsters are bucketed', () => {
    expect(statusOf(pc(100, 100))).toBe('Unharmed')
    expect(statusOf(pc(60, 100))).toBe('Injured')
    expect(statusOf(pc(50, 100))).toBe('Bloodied')
    expect(statusOf(pc(20, 100))).toBe('Critical')
    expect(statusOf(pc(0, 100))).toBe('Down')
  })

  it('reads a monster straight from its broadcast bucket', () => {
    const npc: PlayerParticipant = {
      id: 'm', name: 'Goblin', isPC: false,
      health: { kind: 'npc', status: 'Critical' }, conditions: [],
    }
    expect(statusOf(npc)).toBe('Critical')
  })
})
