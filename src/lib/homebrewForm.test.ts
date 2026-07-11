import { describe, expect, it } from 'vitest'
import { emptyForm, formToStatblock, statblockToForm } from './homebrewForm'

describe('homebrew form conversion', () => {
  it('builds a statblock with parsed lists and bonuses', () => {
    const sb = formToStatblock(
      {
        ...emptyForm,
        name: 'Goblin King',
        ac: '17',
        acFrom: 'plate',
        hpAverage: '82',
        hpFormula: '11d8+33',
        dex: '14',
        savesText: 'dex +5, wis +2',
        skillsText: 'perception +4, stealth +6',
        sensesText: 'Darkvision 60 ft.',
        languagesText: 'Common, Goblin',
        cr: '1/2',
        speedFly: '40',
        traits: [{ name: 'Nimble Escape', text: 'Disengage or Hide as a bonus action.' }],
        actions: [{ name: 'Scimitar', text: 'Melee: +4 to hit.\n5 (1d6 + 2) slashing.' }],
      },
      'hb-goblin-king',
    )

    expect(sb.name).toBe('Goblin King')
    expect(sb.ac).toBe(17)
    expect(sb.saves).toEqual({ dex: 5, wis: 2 })
    expect(sb.skills).toEqual({ perception: 4, stealth: 6 })
    expect(sb.crNumeric).toBe(0.5)
    expect(sb.speed).toEqual([
      { mode: 'walk', value: 30 },
      { mode: 'fly', value: 40 },
    ])
    // initiative falls back to DEX mod
    expect(sb.initiativeBonus).toBe(2)
    expect(sb.actions[0].text).toHaveLength(2)
  })

  it('round-trips through statblockToForm', () => {
    const original = formToStatblock(
      {
        ...emptyForm,
        name: 'Test',
        savesText: 'con +3',
        skillsText: 'arcana +7',
        traits: [{ name: 'A', text: 'line1\nline2' }],
      },
      'hb-test',
    )
    const roundTripped = formToStatblock(statblockToForm(original), 'hb-test')
    expect(roundTripped).toEqual(original)
  })
})
