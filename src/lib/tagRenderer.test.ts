import { describe, expect, it } from 'vitest'
import { renderTags } from './tagRenderer'

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
