import { describe, expect, it } from 'vitest'
import { renderTags, renderTagSegments } from './tagRenderer'

describe('renderTags', () => {
  it('renders 2024 attack roll markup', () => {
    expect(renderTags('{@atkr m}')).toBe('Melee Attack Roll:')
    expect(renderTags('{@atkr r}')).toBe('Ranged Attack Roll:')
    expect(renderTags('{@atkr m,r}')).toBe('Melee or Ranged Attack Roll:')
  })

  it('renders 2014-era attack markup', () => {
    expect(renderTags('{@atk mw}')).toBe('Melee Weapon Attack:')
    expect(renderTags('{@atk mw,rw}')).toBe('Melee or Ranged Weapon Attack:')
  })

  it('renders save-action markup', () => {
    expect(renderTags('{@actSave dex}')).toBe('Dexterity Saving Throw:')
    expect(renderTags('{@actSaveFail}')).toBe('Failure:')
    expect(renderTags('{@actSaveFailBy 5}')).toBe('Failure by 5 or More:')
    expect(renderTags('{@actSaveSuccess}')).toBe('Success:')
    expect(renderTags('{@actSaveSuccessOrFail}')).toBe('Failure or Success:')
    expect(renderTags('{@actTrigger}')).toBe('Trigger:')
    expect(renderTags('{@actResponse}')).toBe('Response:')
  })

  it('renders hit, dc, damage and dice', () => {
    expect(renderTags('{@hit 14}')).toBe('+14')
    expect(renderTags('{@hit -2}')).toBe('-2')
    expect(renderTags('{@dc 21}')).toBe('DC 21')
    expect(renderTags('{@damage 2d6 + 3}')).toBe('2d6 + 3')
    expect(renderTags('{@dice 1d20|d20}')).toBe('d20')
    expect(renderTags('{@h}')).toBe('Hit: ')
    expect(renderTags('{@hom}')).toBe('Hit or Miss: ')
  })

  it('renders recharge', () => {
    expect(renderTags('Fire Breath {@recharge 5}')).toBe('Fire Breath (Recharge 5–6)')
    expect(renderTags('Cone {@recharge}')).toBe('Cone (Recharge 6)')
  })

  it('renders name links with source and display overrides', () => {
    expect(renderTags('{@spell Command|XPHB}')).toBe('Command')
    expect(renderTags('{@variantrule Cone [Area of Effect]|XPHB|Cone}')).toBe('Cone')
    expect(renderTags('{@creature mummy|XMM|mummies}')).toBe('mummies')
    expect(renderTags('{@condition Prone}')).toBe('Prone')
    expect(renderTags('{@status Concentration|XPHB}')).toBe('Concentration')
    expect(renderTags('{@skill Perception}')).toBe('Perception')
    expect(renderTags('{@item Longsword|XPHB}')).toBe('Longsword')
  })

  it('renders a full real action line (Adult Red Dragon, Rend)', () => {
    const src =
      '{@atkr m} {@hit 14}, reach 10 ft. {@h}13 ({@damage 1d10 + 8}) Slashing damage plus 5 ({@damage 2d4}) Fire damage.'
    expect(renderTags(src)).toBe(
      'Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.',
    )
  })

  it('renders a full real save line (Adult Red Dragon, Fire Breath)', () => {
    const src =
      '{@actSave dex} {@dc 21}, each creature in a 60-foot {@variantrule Cone [Area of Effect]|XPHB|Cone}. {@actSaveFail} 59 ({@damage 17d6}) Fire damage. {@actSaveSuccess} Half damage.'
    expect(renderTags(src)).toBe(
      'Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage.',
    )
  })

  it('resolves nested tags innermost-first', () => {
    expect(renderTags('{@b {@damage 2d6}} damage')).toBe('2d6 damage')
    expect(renderTags('{@i takes {@dice 1d4} ({@b fire}) damage}')).toBe('takes 1d4 (fire) damage')
  })

  it('keeps formatting-tag bodies verbatim', () => {
    expect(renderTags('{@b Multiattack.}')).toBe('Multiattack.')
    expect(renderTags('{@note See the rules.}')).toBe('See the rules.')
  })

  it('never leaves an unresolved tag, even for unknown tags', () => {
    const out = renderTags('{@somefuturetag Foo|BAR} and {@another}')
    expect(out).not.toContain('{@')
  })

  it('leaves plain text untouched', () => {
    const src = 'The dragon makes three Rend attacks.'
    expect(renderTags(src)).toBe(src)
  })
})

describe('renderTagSegments', () => {
  it('extracts {@damage} tags as dice segments with exact expressions', () => {
    const src = '{@h}13 ({@damage 1d10 + 8}) Slashing damage plus 5 ({@damage 2d4}) Fire damage.'
    expect(renderTagSegments(src)).toEqual([
      { kind: 'text', text: 'Hit: 13 (' },
      { kind: 'dice', expr: '1d10 + 8', display: '1d10 + 8' },
      { kind: 'text', text: ') Slashing damage plus 5 (' },
      { kind: 'dice', expr: '2d4', display: '2d4' },
      { kind: 'text', text: ') Fire damage.' },
    ])
  })

  it('turns {@hit} into a d20 roll while keeping the "+N" display', () => {
    expect(renderTagSegments('{@atkr m} {@hit 14}, reach 10 ft.')).toEqual([
      { kind: 'text', text: 'Melee Attack Roll: ' },
      { kind: 'dice', expr: '1d20+14', display: '+14' },
      { kind: 'text', text: ', reach 10 ft.' },
    ])
    expect(renderTagSegments('{@hit -2}')).toEqual([{ kind: 'dice', expr: '1d20-2', display: '-2' }])
  })

  it('honors {@dice} display overrides but rolls the real expression', () => {
    expect(renderTagSegments('roll {@dice 1d20|d20}')).toEqual([
      { kind: 'text', text: 'roll ' },
      { kind: 'dice', expr: '1d20', display: 'd20' },
    ])
  })

  it('keeps dice tags rollable through nested formatting tags', () => {
    expect(renderTagSegments('{@b {@damage 2d6}} damage')).toEqual([
      { kind: 'dice', expr: '2d6', display: '2d6' },
      { kind: 'text', text: ' damage' },
    ])
  })

  it('pattern-matches dice in untagged text (homebrew, packs)', () => {
    expect(renderTagSegments('+4 to hit, 1d8 + 2 slashing damage')).toEqual([
      { kind: 'text', text: '+4 to hit, ' },
      { kind: 'dice', expr: '1d8 + 2', display: '1d8 + 2' },
      { kind: 'text', text: ' slashing damage' },
    ])
    expect(renderTagSegments('macht 3w8+5+2w4 Schaden')).toEqual([
      { kind: 'text', text: 'macht ' },
      { kind: 'dice', expr: '3w8+5+2w4', display: '3w8+5+2w4' },
      { kind: 'text', text: ' Schaden' },
    ])
  })

  it('does not match bare numbers or dice-like words', () => {
    expect(renderTagSegments('DC 15, reach 10 ft., AC 2')).toEqual([
      { kind: 'text', text: 'DC 15, reach 10 ft., AC 2' },
    ])
    expect(renderTagSegments('the world10 is old10')).toEqual([{ kind: 'text', text: 'the world10 is old10' }])
  })

  it('numbers around dice tags stay plain text (sentinels do not collide)', () => {
    expect(renderTagSegments('deals 10 ({@damage 3d6}) damage in 5 rounds')).toEqual([
      { kind: 'text', text: 'deals 10 (' },
      { kind: 'dice', expr: '3d6', display: '3d6' },
      { kind: 'text', text: ') damage in 5 rounds' },
    ])
  })

  it('extracts {@condition} and {@status Concentration} as condition refs', () => {
    expect(renderTagSegments('has the {@condition Prone|XPHB} condition')).toEqual([
      { kind: 'text', text: 'has the ' },
      { kind: 'ref', ref: 'condition', name: 'Prone', display: 'Prone' },
      { kind: 'text', text: ' condition' },
    ])
    expect(renderTagSegments('loses {@status Concentration|XPHB}')).toEqual([
      { kind: 'text', text: 'loses ' },
      { kind: 'ref', ref: 'condition', name: 'Concentration', display: 'Concentration' },
    ])
  })

  it('canonicalizes condition names and honors display overrides', () => {
    expect(renderTagSegments('{@condition prone|XPHB|knocked prone}')).toEqual([
      { kind: 'ref', ref: 'condition', name: 'Prone', display: 'knocked prone' },
    ])
  })

  it('leaves unknown {@status}/{@condition} names as plain text (e.g. Bloodied)', () => {
    expect(renderTagSegments('while {@status Bloodied|XPHB}')).toEqual([
      { kind: 'text', text: 'while Bloodied' },
    ])
  })

  it('pattern-matches capitalized condition names in untagged text, but not lowercase prose', () => {
    expect(renderTagSegments('the target has the Restrained condition')).toEqual([
      { kind: 'text', text: 'the target has the ' },
      { kind: 'ref', ref: 'condition', name: 'Restrained', display: 'Restrained' },
      { kind: 'text', text: ' condition' },
    ])
    expect(renderTagSegments('is knocked prone and blinded by light')).toEqual([
      { kind: 'text', text: 'is knocked prone and blinded by light' },
    ])
  })

  it('extracts {@spell} tags as spell refs', () => {
    expect(renderTagSegments('casts {@spell Fireball|XPHB}')).toEqual([
      { kind: 'text', text: 'casts ' },
      { kind: 'ref', ref: 'spell', name: 'Fireball', display: 'Fireball' },
    ])
  })

  it('honors {@spell} display overrides while keeping the lookup name', () => {
    expect(renderTagSegments('{@spell Scorching Ray|XPHB|scorching ray}')).toEqual([
      { kind: 'ref', ref: 'spell', name: 'Scorching Ray', display: 'scorching ray' },
    ])
  })

  it('does not pattern-match spell names in untagged text', () => {
    expect(renderTagSegments('casts Fireball at the party')).toEqual([
      { kind: 'text', text: 'casts Fireball at the party' },
    ])
  })

  it('mixes spell, dice and condition segments in one line', () => {
    expect(renderTagSegments('casts {@spell Hold Person|XPHB}: {@condition Paralyzed|XPHB} on a failed save, or takes {@damage 2d8} damage')).toEqual([
      { kind: 'text', text: 'casts ' },
      { kind: 'ref', ref: 'spell', name: 'Hold Person', display: 'Hold Person' },
      { kind: 'text', text: ': ' },
      { kind: 'ref', ref: 'condition', name: 'Paralyzed', display: 'Paralyzed' },
      { kind: 'text', text: ' on a failed save, or takes ' },
      { kind: 'dice', expr: '2d8', display: '2d8' },
      { kind: 'text', text: ' damage' },
    ])
  })

  it('extracts {@item} and {@creature} tags as refs with display overrides', () => {
    expect(renderTagSegments('wields a {@item Longsword|XPHB}')).toEqual([
      { kind: 'text', text: 'wields a ' },
      { kind: 'ref', ref: 'item', name: 'Longsword', display: 'Longsword' },
    ])
    expect(renderTagSegments('summons {@creature mummy|XMM|mummies}')).toEqual([
      { kind: 'text', text: 'summons ' },
      { kind: 'ref', ref: 'creature', name: 'mummy', display: 'mummies' },
    ])
  })

  it('extracts {@variantrule} tags as rule refs with display overrides', () => {
    expect(renderTagSegments('has {@variantrule Cover|XPHB}')).toEqual([
      { kind: 'text', text: 'has ' },
      { kind: 'ref', ref: 'rule', name: 'Cover', display: 'Cover' },
    ])
    expect(renderTagSegments('a 60-foot {@variantrule Cone [Area of Effect]|XPHB|Cone}')).toEqual([
      { kind: 'text', text: 'a 60-foot ' },
      { kind: 'ref', ref: 'rule', name: 'Cone [Area of Effect]', display: 'Cone' },
    ])
  })

  it('mixes dice and condition segments in one homebrew line', () => {
    expect(renderTagSegments('takes 2d6+3 damage and is Poisoned')).toEqual([
      { kind: 'text', text: 'takes ' },
      { kind: 'dice', expr: '2d6+3', display: '2d6+3' },
      { kind: 'text', text: ' damage and is ' },
      { kind: 'ref', ref: 'condition', name: 'Poisoned', display: 'Poisoned' },
    ])
  })
})
