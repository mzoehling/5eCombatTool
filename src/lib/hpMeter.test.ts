import { describe, expect, it } from 'vitest'
import { hpMeterWidths } from './hpMeter'

describe('hpMeterWidths', () => {
  it('extends the scale by temp HP instead of eating into the max', () => {
    // 90/100 with 20 temp: the bar spans the full 120-point pool, so all 20
    // temp are visible and the 10 points of damage stay as the empty tail.
    const w = hpMeterWidths(90, 100, 20)
    expect(w.hp).toBeCloseTo(75)
    expect(w.temp).toBeCloseTo((20 / 120) * 100)
    expect(w.hp + w.temp).toBeCloseTo((110 / 120) * 100)
  })

  it('fills the bar with no temp HP', () => {
    expect(hpMeterWidths(100, 100)).toEqual({ hp: 100, temp: 0 })
    expect(hpMeterWidths(50, 100)).toEqual({ hp: 50, temp: 0 })
  })

  it('clamps a downed combatant and a zero max', () => {
    expect(hpMeterWidths(-5, 100).hp).toBe(0)
    expect(hpMeterWidths(0, 0).hp).toBe(0)
  })

  it('shows temp HP on a downed combatant as the whole bar', () => {
    expect(hpMeterWidths(0, 20, 5)).toEqual({ hp: 0, temp: 20 })
  })
})
