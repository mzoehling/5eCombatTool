import { describe, expect, it } from 'vitest'
import { healthStatus, STAGE_COLOR, STAGE_TINT } from './healthStage'

describe('healthStatus', () => {
  it('puts Bloodied exactly at half, as the rules do', () => {
    // "A creature is Bloodied while it has half its Hit Points or fewer
    // remaining" (XPHB p. 362) — so half itself is Bloodied, not Injured.
    expect(healthStatus(50, 100)).toBe('Bloodied')
    expect(healthStatus(51, 100)).toBe('Injured')
  })

  it('treats a single point of damage as Injured', () => {
    expect(healthStatus(100, 100)).toBe('Unharmed')
    expect(healthStatus(99, 100)).toBe('Injured')
  })

  it('turns Critical at a quarter and below', () => {
    expect(healthStatus(26, 100)).toBe('Bloodied')
    expect(healthStatus(25, 100)).toBe('Critical')
    expect(healthStatus(1, 100)).toBe('Critical')
  })

  it('is Down at zero or below, whatever the max', () => {
    expect(healthStatus(0, 100)).toBe('Down')
    expect(healthStatus(-8, 100)).toBe('Down')
    expect(healthStatus(0, 0)).toBe('Down')
  })

  it('survives a zero max without dividing by it', () => {
    expect(healthStatus(5, 0)).toBe('Unharmed')
  })
})

describe('stage presentation', () => {
  it('covers every stage in both tables', () => {
    // A stage missing from either would render as `undefined` inside a
    // color-mix and silently drop the row's whole background.
    const stages = ['Unharmed', 'Injured', 'Bloodied', 'Critical', 'Down'] as const
    for (const s of stages) {
      expect(STAGE_COLOR[s]).toMatch(/^var\(--/)
      expect(STAGE_TINT[s]).toBeGreaterThan(0)
    }
  })

  it('deepens the tint as health falls, then goes quiet at Down', () => {
    expect(STAGE_TINT.Unharmed).toBeLessThan(STAGE_TINT.Injured)
    expect(STAGE_TINT.Injured).toBeLessThan(STAGE_TINT.Bloodied)
    expect(STAGE_TINT.Bloodied).toBeLessThan(STAGE_TINT.Critical)
    expect(STAGE_TINT.Down).toBeLessThan(STAGE_TINT.Injured)
  })

  it('shares --danger between Bloodied and Critical, separated by depth alone', () => {
    expect(STAGE_COLOR.Bloodied).toBe(STAGE_COLOR.Critical)
    expect(STAGE_TINT.Bloodied).not.toBe(STAGE_TINT.Critical)
  })
})
