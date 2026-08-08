import { describe, expect, it } from 'vitest'
import { hpMeterGradient, hpMeterStyle, hpMeterWidths, hpStageStyle, hpStageTint } from './hpMeter'

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

describe('hpStageTint', () => {
  it('deepens as health falls, and goes quiet again at zero', () => {
    // The ramp is what separates Bloodied from Critical — both are --danger.
    expect(hpStageTint('Unharmed')).toBe('color-mix(in srgb, var(--ok) 5%, var(--bg-panel))')
    expect(hpStageTint('Injured')).toBe('color-mix(in srgb, var(--warn) 10%, var(--bg-panel))')
    expect(hpStageTint('Bloodied')).toBe('color-mix(in srgb, var(--danger) 14%, var(--bg-panel))')
    expect(hpStageTint('Critical')).toBe('color-mix(in srgb, var(--danger) 18%, var(--bg-panel))')
    expect(hpStageTint('Down')).toBe('color-mix(in srgb, var(--text-dim) 6%, var(--bg-panel))')
  })

  it('mixes into the panel surface, never into transparency', () => {
    // A tint over nothing would let whatever is behind the row through, and the
    // row would read differently on the tracker than in a dialog.
    expect(hpStageTint('Bloodied')).toContain('var(--bg-panel)')
  })
})

describe('hpMeterGradient', () => {
  it('runs the full row width, with the tail as the damage taken', () => {
    // Unlike the fill it replaces, the meter always spans 100%: it is a bar
    // along the bottom edge, so the empty part has to be drawn, not omitted.
    expect(hpMeterGradient(50, 100)).toContain('var(--surface-sunken) 50% 100%)')
    expect(Math.max(...stops(hpMeterGradient(100, 100)))).toBe(100)
  })

  it('takes the stage colour, not one colour for every ratio', () => {
    expect(hpMeterGradient(100, 100)).toContain('var(--ok) 0 100%')
    expect(hpMeterGradient(80, 100)).toContain('var(--warn) 0 80%')
    expect(hpMeterGradient(40, 100)).toContain('var(--danger) 0 40%')
    expect(hpMeterGradient(10, 100)).toContain('var(--danger) 0 10%')
    expect(hpMeterGradient(0, 100)).toContain('var(--text-dim) 0 0%')
  })

  it('gives temp HP the outermost slice in violet', () => {
    // Never gold: beside the danger colour of a critical creature, gold reads
    // as another health level.
    const g = hpMeterGradient(90, 100, 20)
    const s = stops(g)
    expect(g).toContain('var(--magic)')
    expect(s[0]).toBeCloseTo(75, 1)
    expect(s[1]).toBeCloseTo(75, 1)
    expect(s[2]).toBeCloseTo((110 / 120) * 100, 1)
    expect(g.indexOf('var(--magic)')).toBeGreaterThan(g.indexOf('var(--warn)'))
  })

  it('draws a downed combatant holding temp HP as temp alone', () => {
    const g = hpMeterGradient(0, 20, 5)
    expect(g).toContain('var(--text-dim) 0 0%')
    expect(g).toContain('var(--magic) 0% 20%')
  })

  it('rounds stops to two decimals so neighbouring sections never seam', () => {
    // 1/3 of 100 is 33.333…; an unrounded stop and its neighbour can disagree
    // in the last place and leave a hairline of the layer beneath showing.
    const s = stops(hpMeterGradient(1, 3))
    expect(s[0]).toBe(33.33)
    expect(s[1]).toBe(33.33)
  })

  it('is a background-image value, never a colour', () => {
    // The tint is `background-color` on the layer beneath; one property for
    // both would mean whichever is written last silently wins.
    expect(hpMeterGradient(60, 100)).toMatch(/^linear-gradient\(90deg, /)
  })
})

describe('hpMeterStyle', () => {
  it('hands the row both layers plus the HP figure colour', () => {
    const s = hpMeterStyle(40, 100)
    expect(s['--hp-tint']).toBe(hpStageTint('Bloodied'))
    expect(s['--hp-meter']).toBe(hpMeterGradient(40, 100))
    expect(s['--hp-figure']).toBe('var(--danger)')
  })

  it('leaves the HP figure alone at full health', () => {
    // An undamaged creature should not have a green number shouting about it.
    expect(hpMeterStyle(100, 100)['--hp-figure']).toBe('var(--text)')
    expect(hpMeterStyle(99, 100)['--hp-figure']).toBe('var(--warn)')
  })
})

describe('hpStageStyle', () => {
  it('draws from the stage alone, with no hit points anywhere in the output', () => {
    // The players' snapshot carries a status word for monsters and no numbers;
    // the meter must not be the thing that leaks them back.
    const s = hpStageStyle('Bloodied', 50)
    expect(s['--hp-meter']).toBe(
      'linear-gradient(90deg, var(--danger) 0 50%, var(--surface-sunken) 50% 100%)',
    )
    expect(s['--hp-tint']).toBe(hpStageTint('Bloodied'))
  })

  it('has no temp slice — temp is not in the snapshot for a monster', () => {
    expect(hpStageStyle('Injured', 75)['--hp-meter']).not.toContain('var(--magic)')
  })
})
