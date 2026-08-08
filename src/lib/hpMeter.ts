import { healthStatus, STAGE_COLOR, STAGE_TINT, type HealthStatus } from './healthStage'

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

/** Two decimals: enough to place a stop exactly, few enough to avoid seams. */
function stop(n: number): string {
  return `${Math.round(n * 100) / 100}%`
}

/**
 * The tint a stage paints the row's surface with, as a `background-color`.
 *
 * Separate from the meter because it is a different layer: the tint is
 * `background-color`, the meter is `background-image`, and collapsing the two
 * into one property means whichever is written last wins and the other silently
 * disappears. Never a gradient and never a hard edge — a hard edge behind text
 * is exactly what this replaced.
 */
export function hpStageTint(stage: HealthStatus): string {
  return `color-mix(in srgb, ${STAGE_COLOR[stage]} ${STAGE_TINT[stage]}%, var(--bg-panel))`
}

/**
 * The baseline meter, as a `background-image`.
 *
 * Three hard sections and no fade: unlike the full-height fill this replaces,
 * the meter is a 4px bar along the row's bottom edge with nothing written over
 * it, so it can be exact. Softening it would only make the reading fuzzy.
 *
 * Temp HP takes the outermost slice in `--magic` violet, never gold: gold next
 * to the danger colour of a critical creature reads as another health level,
 * and the boundary between "nearly dead" and "has a cushion" is precisely where
 * that must not happen. The tail is `--surface-sunken`, so the damage taken is
 * a visible gap rather than nothing.
 *
 * The bar's geometry (`no-repeat`, `100% 4px`, `bottom left`) is constant and
 * lives in CSS; only the stops change per row.
 */
export function hpMeterGradient(hp: number, maxHp: number, tempHp = 0, stage = healthStatus(hp, maxHp)): string {
  const { hp: hpPercent, temp: tempPercent } = hpMeterWidths(hp, maxHp, tempHp)
  const end = hpPercent + tempPercent
  return (
    `linear-gradient(90deg, ${STAGE_COLOR[stage]} 0 ${stop(hpPercent)}, ` +
    `var(--magic) ${stop(hpPercent)} ${stop(end)}, ` +
    `var(--surface-sunken) ${stop(end)} 100%)`
  )
}

/**
 * Everything a row needs to draw its health, keyed by the custom property that
 * carries it.
 *
 * Custom properties rather than direct style values: that is how the rest of
 * this app hands dynamic geometry to CSS, and it keeps the row free to decide
 * *where* the tint and the meter apply without the component knowing.
 *
 * `--hp-figure` is the HP number's own colour. At full health it stays
 * `--text`, because a creature that has taken no damage should not have a green
 * number shouting about it; below full it takes the stage colour, so the figure
 * and the row agree at a glance.
 */
export function hpMeterStyle(hp: number, maxHp: number, tempHp = 0): Record<string, string> {
  const stage = healthStatus(hp, maxHp)
  return {
    '--hp-tint': hpStageTint(stage),
    '--hp-meter': hpMeterGradient(hp, maxHp, tempHp, stage),
    '--hp-figure': stage === 'Unharmed' ? 'var(--text)' : STAGE_COLOR[stage],
  }
}

/**
 * The same treatment for a creature whose exact hit points are not known.
 *
 * The players' snapshot carries a status word for monsters and no numbers at
 * all (`projection.ts`), deliberately. The viewer still wants a tint and a
 * meter, so it draws them at the stage's nominal percentage instead — which is
 * the whole point: the bar can never leak a hit point total the DM withheld.
 */
export function hpStageStyle(stage: HealthStatus, percent: number): Record<string, string> {
  return {
    '--hp-tint': hpStageTint(stage),
    '--hp-meter':
      `linear-gradient(90deg, ${STAGE_COLOR[stage]} 0 ${stop(percent)}, ` +
      `var(--surface-sunken) ${stop(percent)} 100%)`,
    '--hp-figure': stage === 'Unharmed' ? 'var(--text)' : STAGE_COLOR[stage],
  }
}
