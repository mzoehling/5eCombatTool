/**
 * Geometry for the reference drawer (statblock and, later, the compendium).
 *
 * The drawer is not a flex sibling of the tracker with a fixed ratio — it has
 * three states and a drag gesture, and its upper bound is derived from what the
 * tracker row still needs rather than from a percentage. A 70% drawer on a
 * 1366px iPad would leave the tracker 410px and break the row's fixed right
 * blocks; the limit therefore reads "the tracker keeps at least X" in
 * landscape and "at least N rows stay visible" in portrait.
 *
 * All of this is pure so it can be tested: the component only feeds it the
 * measured viewport and renders the result.
 */

/** Which edge the drawer comes in from. Derived from orientation, never stored. */
export type DrawerSide = 'right' | 'bottom'

/** Closed, at the remembered size, or at the largest size the tracker allows. */
export type DrawerMode = 'closed' | 'docked' | 'expanded'

/** Below this a statblock cannot be read at all, so the drawer never gets less. */
export const DRAWER_MIN = 280

/** Released below this, the gesture reads as "put it away" rather than "make it small". */
export const CLOSE_THRESHOLD = 170

/** Released within this of the maximum, the drawer snaps to expanded. */
export const EXPAND_SNAP = 28

/**
 * Width the tracker keeps in landscape. The row's right-hand blocks are fixed
 * (button 44 + shield 42 + hp text 74 + tmp 56 + ±hp 78 ≈ 350) and the
 * initiative block is 62; the rest is the readable remainder for the name and
 * the condition chips.
 */
export const TRACKER_MIN_WIDTH = 720

/** Rows that stay visible in portrait — enough to see the turn order around you. */
export const TRACKER_MIN_ROWS = 5

/** Portrait equivalent of `TRACKER_MIN_WIDTH`: N rows plus the dock below them. */
export function trackerMinHeight(rowHeight: number, dockHeight: number): number {
  return TRACKER_MIN_ROWS * rowHeight + dockHeight
}

export interface DrawerBounds {
  min: number
  max: number
}

/**
 * How large the drawer may get along its own axis.
 *
 * `extent` is the space the panes have on that axis, `trackerMin` what the
 * tracker must keep. On a viewport too small to honour both, the drawer's
 * minimum wins — a drawer narrower than `DRAWER_MIN` shows nothing useful, and
 * that case is a phone, where the panes stack anyway.
 */
export function drawerBounds(extent: number, trackerMin: number): DrawerBounds {
  const max = Math.max(DRAWER_MIN, Math.min(extent, extent - trackerMin))
  return { min: Math.min(DRAWER_MIN, max), max }
}

export function clampDrawerSize(size: number, bounds: DrawerBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, size))
}

/** Opening size for an axis that has no remembered value yet. */
export function defaultDrawerSize(extent: number, trackerMin: number): number {
  return clampDrawerSize(Math.round(extent * 0.4), drawerBounds(extent, trackerMin))
}

/** The rendered size of each mode. Expanded is "as large as allowed", so it
 *  follows the viewport instead of being a remembered number. */
export function sizeForMode(mode: DrawerMode, docked: number, bounds: DrawerBounds): number {
  if (mode === 'closed') return 0
  if (mode === 'expanded') return bounds.max
  return clampDrawerSize(docked, bounds)
}

export interface DrawerRelease {
  mode: DrawerMode
  /** The size to remember for this axis. Unchanged when the drawer was closed. */
  docked: number
}

/**
 * What letting go of the handle means. Dragging almost shut closes the drawer;
 * dragging to the limit snaps it to expanded, so the state survives a rotation
 * or a viewport change instead of being frozen at yesterday's pixel count.
 */
export function resolveDrawerRelease(size: number, bounds: DrawerBounds, previousDocked: number): DrawerRelease {
  if (size < CLOSE_THRESHOLD) return { mode: 'closed', docked: previousDocked }
  const clamped = clampDrawerSize(size, bounds)
  if (clamped >= bounds.max - EXPAND_SNAP) return { mode: 'expanded', docked: previousDocked }
  return { mode: 'docked', docked: clamped }
}

/**
 * Turns a pointer position into a drawer size. Both edges read the same way
 * because the drawer always grows towards the pointer: `pointer` is clientX
 * against the right edge, clientY against the bottom one.
 */
export function sizeFromPointer(pointer: number, viewportEnd: number): number {
  return Math.max(0, viewportEnd - pointer)
}
