// Rules text for conditions (SRD 5.2.1, CC-BY-4.0) and for the tracked
// spell effects, shown in the statblock panel's "Active Conditions" tab.

import { CONDITIONS, SPELL_EFFECTS, type ConditionName, type SpellEffectName } from '../types'

export const CONDITION_DESCRIPTIONS: Record<ConditionName, string> = {
  Blinded:
    "Can't see and automatically fails any ability check that requires sight. Attack rolls against it have Advantage, and its attack rolls have Disadvantage.",
  Charmed:
    "Can't attack the charmer or target the charmer with damaging abilities or magical effects. The charmer has Advantage on any ability check to interact socially with it.",
  Deafened: "Can't hear and automatically fails any ability check that requires hearing.",
  Frightened:
    'Has Disadvantage on ability checks and attack rolls while the source of fear is within line of sight, and can\'t willingly move closer to the source of fear.',
  Grappled:
    "Speed is 0 and can't increase. Attack rolls have Disadvantage against any target other than the grappler. The grappler can drag or carry it, at Slowed movement unless the creature is Tiny or two or more sizes smaller.",
  Incapacitated:
    "Can't take any action, Bonus Action, or Reaction; Concentration is broken; can't speak. If Incapacitated when rolling Initiative, has Disadvantage on the roll.",
  Invisible:
    "Can't be seen without special senses and counts as Heavily Obscured for hiding. Attack rolls against it have Disadvantage, and its attack rolls have Advantage.",
  Paralyzed:
    'Has the Incapacitated condition and can\'t move or speak. Automatically fails Strength and Dexterity saving throws. Attack rolls against it have Advantage, and any hit from within 5 feet is a Critical Hit.',
  Petrified:
    'Turned to solid inanimate matter (weight ×10, aging stops). Has the Incapacitated condition, can\'t move or speak, and is unaware of its surroundings. Automatically fails Strength and Dexterity saves, attacks against it have Advantage, it has Resistance to all damage, and is immune to the Poisoned condition.',
  Poisoned: 'Has Disadvantage on attack rolls and ability checks.',
  Prone:
    'Can only crawl or spend movement to stand up. Has Disadvantage on attack rolls. Attack rolls against it have Advantage from within 5 feet, otherwise Disadvantage.',
  Restrained:
    "Speed is 0 and can't increase. Attack rolls against it have Advantage, its attack rolls have Disadvantage, and it has Disadvantage on Dexterity saving throws.",
  Stunned:
    'Has the Incapacitated condition. Automatically fails Strength and Dexterity saving throws, and attack rolls against it have Advantage.',
  Unconscious:
    'Has the Incapacitated and Prone conditions and drops whatever it is holding. Automatically fails Strength and Dexterity saves, attacks against it have Advantage, any hit from within 5 feet is a Critical Hit, and it is unaware of its surroundings.',
  Exhaustion:
    'Cumulative levels 1–6. Each level gives −2 to all d20 Tests (attack rolls, checks, saves) and −5 feet Speed. At level 6 the creature dies. A Long Rest removes one level.',
  Concentration:
    'Maintaining a spell. Ends early when the creature is Incapacitated, casts another concentration spell, or fails a Constitution saving throw (DC 10 or half the damage taken, whichever is higher) after taking damage.',
}

export const SPELL_EFFECT_DESCRIPTIONS: Record<SpellEffectName, string> = {
  "Hunter's Mark":
    'Marked as quarry: takes an extra 1d6 Force damage each time the caster hits it with an attack roll. The caster has Advantage on Wisdom (Perception/Survival) checks to find it.',
  Hex: 'Cursed: takes an extra 1d6 Necrotic damage from the caster\'s attacks and has Disadvantage on ability checks with the ability chosen by the caster.',
  Bane: 'Subtracts 1d4 from each attack roll and saving throw it makes while the spell lasts.',
  Bless: 'Adds 1d4 to each attack roll and saving throw it makes while the spell lasts.',
  'Faerie Fire':
    'Outlined in light: attack rolls against it have Advantage if the attacker can see it, and it gains no benefit from the Invisible condition.',
  'Guiding Bolt': 'The next attack roll made against it before the end of the caster\'s next turn has Advantage.',
  Haste:
    'Speed doubled, +2 bonus to AC, Advantage on Dexterity saving throws, and one additional limited action each turn. When the spell ends, it can\'t move or take actions until after its next turn.',
  Slow: 'Speed halved, −2 penalty to AC and Dexterity saving throws, no Reactions, and only an action or a Bonus Action each turn (not both).',
}

const ALL_DESCRIPTIONS: Record<string, string> = { ...CONDITION_DESCRIPTIONS, ...SPELL_EFFECT_DESCRIPTIONS }

/** Description for a condition or spell effect; undefined for custom effects. */
export function describeCondition(name: string): string | undefined {
  return ALL_DESCRIPTIONS[name]
}

export function isKnownCondition(name: string): boolean {
  return (CONDITIONS as readonly string[]).includes(name) || (SPELL_EFFECTS as readonly string[]).includes(name)
}
