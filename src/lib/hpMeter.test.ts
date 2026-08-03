import { describe, expect, it } from 'vitest'
import { HP_FILL_EXTENT, hpFillGradient, hpMeterWidths } from './hpMeter'

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

/** Every stop as a number, so the assertions can talk about geometry. */
function stops(gradient: string): number[] {
  return [...gradient.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]))
}

describe('hpFillGradient', () => {
  it('never runs past the row, even with temp HP on top', () => {
    expect(Math.max(...stops(hpFillGradient(100, 100)))).toBeLessThanOrEqual(HP_FILL_EXTENT)
    expect(Math.max(...stops(hpFillGradient(100, 100, 50)))).toBeLessThanOrEqual(HP_FILL_EXTENT)
  })

  it('fills the whole row at full health', () => {
    // A full bar has to read as a full row — that is the point of making it the
    // row's background rather than a strip inside it.
    expect(HP_FILL_EXTENT).toBe(100)
    expect(hpFillGradient(100, 100)).toContain(`transparent ${HP_FILL_EXTENT}%`)
  })

  it('scales with the health ratio', () => {
    const half = Math.max(...stops(hpFillGradient(50, 100)))
    const full = Math.max(...stops(hpFillGradient(100, 100)))
    expect(half).toBeCloseTo(full / 2, 1)
  })

  it('draws nothing for a combatant at zero', () => {
    expect(hpFillGradient(0, 100)).toBe('none')
    expect(hpFillGradient(0, 0)).toBe('none')
  })

  it('gives temp HP its own colour as the outermost slice', () => {
    const g = hpFillGradient(90, 100, 20)
    expect(g).toContain('var(--hp-fill) 0')
    expect(g).toContain('var(--hp-temp-fill)')
    // hp ends at 75% of the pool, temp carries on to 110/120 — both scaled into
    // the extent, and the temp section starts where the hp section stops.
    const s = stops(g)
    expect(s[0]).toBeCloseTo(75 * (HP_FILL_EXTENT / 100), 1)
    expect(s[1]).toBeCloseTo(s[0], 1)
    expect(Math.max(...s)).toBeCloseTo((110 / 120) * HP_FILL_EXTENT, 1)
  })

  it('keeps the fade inside the fill so the bar never overstates the hit points', () => {
    // A fade that extended past the end would read as more HP than there is.
    const g = hpFillGradient(50, 100)
    const s = stops(g)
    expect(s[0]).toBeLessThan(s[1])
    expect(Math.max(...s)).toBeCloseTo(50 * (HP_FILL_EXTENT / 100), 1)
  })

  it('holds the fade at the hp/temp boundary when the temp slice is thin', () => {
    // Otherwise a 1-point temp slice would soften the current-HP colour instead
    // of tinting its own section.
    const g = hpFillGradient(100, 100, 1)
    const s = stops(g)
    expect(s[0]).toBeCloseTo(s[1], 2)
    expect(s[1]).toBeLessThanOrEqual(s[2])
  })

  it('shows only the temp slice for a downed combatant holding temp HP', () => {
    const g = hpFillGradient(0, 20, 5)
    expect(g).toContain('var(--hp-fill) 0 0%')
    expect(Math.max(...stops(g))).toBeCloseTo(20 * (HP_FILL_EXTENT / 100), 1)
  })

  it('is a background-image value, never a colour', () => {
    // The row's state colour is `background-color` underneath; one property for
    // both would mean whichever is written last silently wins.
    expect(hpFillGradient(60, 100)).toMatch(/^linear-gradient\(90deg, /)
  })
})
