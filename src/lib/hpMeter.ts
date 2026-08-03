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

/**
 * How far across the row a full bar reaches, in percent.
 *
 * The whole row: full health reads as a full row, which is the point of making
 * the bar the row's own background rather than an 11px strip inside it.
 *
 * It stopped short of the number column for a while, so that no tint would ever
 * sit behind a digit. But every number on the right already has its own surface —
 * the HP fields are inputs, the AC is a shield glyph, the chips and the AoE
 * preview are pills — so there was nothing there to protect, and the shortfall
 * only made a healthy creature's bar look partial.
 */
export const HP_FILL_EXTENT = 100

/** Width of the soft edge at the outer end of the fill, in percent of the row. */
const FADE = 5

/**
 * The row-background gradient for a health bar, as a CSS `linear-gradient`.
 *
 * Built here rather than in CSS because the shape genuinely differs with and
 * without temp HP — temp is the outermost section and needs its own colour stop
 * — and because a string is something a test can pin down exactly. Colours stay
 * in CSS: the stops reference `--hp-fill` and `--hp-temp-fill`, which
 * `CombatantRow` and the theme set.
 *
 * This is `background-image`. The row's state (active turn, AoE selection, out
 * of battle) is `background-color`, a separate layer underneath — collapsing the
 * two into one property means whichever is written last wins and the other
 * silently disappears.
 */
export function hpFillGradient(hp: number, maxHp: number, tempHp = 0): string {
  const { hp: hpPercent, temp: tempPercent } = hpMeterWidths(hp, maxHp, tempHp)
  const scale = HP_FILL_EXTENT / 100
  const hpEnd = hpPercent * scale
  const end = (hpPercent + tempPercent) * scale
  if (end <= 0) return 'none'

  const round = (n: number) => `${Math.round(n * 100) / 100}%`

  if (tempPercent > 0) {
    // Temp HP is part of the fill: it extends the scale and takes the outermost
    // slice, tinted differently. Never an overhang, never clipped — see
    // `hpMeterWidths`. The fade is held at the hp/temp boundary at the earliest,
    // so a temp slice narrower than the fade simply *is* the fade instead of
    // bleeding the softness back into the current-HP colour.
    const fadeStart = Math.max(hpEnd, end - FADE)
    return `linear-gradient(90deg, var(--hp-fill) 0 ${round(hpEnd)}, var(--hp-temp-fill) ${round(hpEnd)} ${round(fadeStart)}, transparent ${round(end)})`
  }

  // The fade eats into the fill rather than extending past it, so the bar never
  // reads as longer than the hit points it stands for.
  const fadeStart = Math.max(0, end - FADE)
  return `linear-gradient(90deg, var(--hp-fill) 0 ${round(fadeStart)}, transparent ${round(end)})`
}
