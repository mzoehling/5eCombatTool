/**
 * Widths for the HP meter, as percentages of the bar.
 *
 * Temporary hit points extend the scale rather than eating into it. Drawing
 * them inside the max clipped them against the fill — 20 temp on 90/100 showed
 * as 10, and vanished entirely at full health — so the bar now spans the whole
 * pool the creature could have, `maxHp + tempHp`. All 20 are visible, and the
 * damage taken stays as the empty tail.
 *
 * The scale is therefore dynamic: granting temp moves the fill for unchanged
 * hit points. That is right — the fill reads as "share of everything between me
 * and zero", and temp genuinely changes that.
 */
export function hpMeterWidths(hp: number, maxHp: number, tempHp = 0): { hp: number; temp: number } {
  const scale = Math.max(1, maxHp + Math.max(0, tempHp))
  const hpPercent = Math.max(0, Math.min(100, (Math.max(0, hp) / scale) * 100))
  const tempPercent = Math.max(0, Math.min(100 - hpPercent, (Math.max(0, tempHp) / scale) * 100))
  return { hp: hpPercent, temp: tempPercent }
}
