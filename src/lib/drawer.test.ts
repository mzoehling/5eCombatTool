import { describe, expect, it } from 'vitest'
import {
  CLOSE_THRESHOLD,
  DRAWER_MIN,
  clampDrawerSize,
  defaultDrawerSize,
  drawerBounds,
  resolveDrawerRelease,
  sizeForMode,
  sizeFromPointer,
  trackerMinHeight,
  TRACKER_MIN_WIDTH,
} from './drawer'

// The target device is an iPad Pro 12.9" (4th gen): 1366×1024 landscape,
// 1024×1366 portrait. Every bound is checked against those two numbers, since a
// limit that only holds on a desktop is no limit at all here.
const IPAD_LONG = 1366
const IPAD_SHORT = 1024

describe('drawerBounds', () => {
  it('leaves the tracker its minimum width in landscape', () => {
    const { max } = drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH)
    expect(max).toBe(IPAD_LONG - TRACKER_MIN_WIDTH)
    expect(IPAD_LONG - max).toBeGreaterThanOrEqual(TRACKER_MIN_WIDTH)
  })

  it('rejects the percentage limit that would break the row', () => {
    // 70% of 1366 leaves the tracker 410px — the row's fixed right blocks alone
    // are ~350px. The derived bound must not permit it.
    const { max } = drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH)
    expect(max).toBeLessThan(IPAD_LONG * 0.7)
  })

  it('keeps five rows visible in portrait', () => {
    const rowHeight = 118
    const dock = 64
    const extent = IPAD_LONG - 120 // top bar and footer
    const trackerMin = trackerMinHeight(rowHeight, dock)
    const { max } = drawerBounds(extent, trackerMin)
    expect(Math.floor((extent - max - dock) / rowHeight)).toBeGreaterThanOrEqual(5)
  })

  it('never goes below a readable width, even when the tracker cannot keep its minimum', () => {
    const { min, max } = drawerBounds(600, TRACKER_MIN_WIDTH)
    expect(max).toBe(DRAWER_MIN)
    expect(min).toBe(DRAWER_MIN)
  })

  it('never exceeds the viewport', () => {
    expect(drawerBounds(400, 0).max).toBe(400)
  })
})

describe('clampDrawerSize', () => {
  const bounds = drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH)

  it('holds a size inside the bounds', () => {
    expect(clampDrawerSize(500, bounds)).toBe(500)
  })

  it('pulls an oversized drag back to the maximum', () => {
    expect(clampDrawerSize(1200, bounds)).toBe(bounds.max)
  })

  it('pushes an undersized drag up to the minimum', () => {
    expect(clampDrawerSize(40, bounds)).toBe(bounds.min)
  })
})

describe('defaultDrawerSize', () => {
  it('opens at a usable fraction on both orientations', () => {
    const landscape = defaultDrawerSize(IPAD_LONG, TRACKER_MIN_WIDTH)
    const portrait = defaultDrawerSize(IPAD_LONG - 120, trackerMinHeight(118, 64))
    for (const size of [landscape, portrait]) {
      expect(size).toBeGreaterThanOrEqual(DRAWER_MIN)
    }
    expect(landscape).toBeLessThanOrEqual(drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH).max)
  })

  it('differs between the axes, which is why each is remembered separately', () => {
    expect(defaultDrawerSize(IPAD_LONG, TRACKER_MIN_WIDTH)).not.toBe(
      defaultDrawerSize(IPAD_SHORT, TRACKER_MIN_WIDTH),
    )
  })
})

describe('sizeForMode', () => {
  const bounds = drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH)

  it('gives a closed drawer no extent', () => {
    expect(sizeForMode('closed', 500, bounds)).toBe(0)
  })

  it('gives a docked drawer its remembered size', () => {
    expect(sizeForMode('docked', 500, bounds)).toBe(500)
  })

  it('clamps a remembered size that no longer fits the viewport', () => {
    // Remembered in landscape, then rotated: the number must not survive as-is.
    expect(sizeForMode('docked', 600, drawerBounds(IPAD_SHORT, TRACKER_MIN_WIDTH))).toBe(
      drawerBounds(IPAD_SHORT, TRACKER_MIN_WIDTH).max,
    )
  })

  it('follows the viewport when expanded rather than a stored number', () => {
    expect(sizeForMode('expanded', 300, bounds)).toBe(bounds.max)
  })
})

describe('resolveDrawerRelease', () => {
  const bounds = drawerBounds(IPAD_LONG, TRACKER_MIN_WIDTH)

  it('closes when dragged almost shut', () => {
    expect(resolveDrawerRelease(CLOSE_THRESHOLD - 1, bounds, 500)).toEqual({ mode: 'closed', docked: 500 })
  })

  it('keeps the previously remembered size when closing', () => {
    // Closing is not resizing: reopening must return to where it was.
    expect(resolveDrawerRelease(10, bounds, 480).docked).toBe(480)
  })

  it('docks at the released size', () => {
    expect(resolveDrawerRelease(400, bounds, 500)).toEqual({ mode: 'docked', docked: 400 })
  })

  it('snaps to expanded near the limit and does not remember that size', () => {
    const release = resolveDrawerRelease(bounds.max - 4, bounds, 480)
    expect(release.mode).toBe('expanded')
    expect(release.docked).toBe(480)
  })

  it('treats a drag past the limit as expanded', () => {
    expect(resolveDrawerRelease(2000, bounds, 480).mode).toBe('expanded')
  })
})

describe('sizeFromPointer', () => {
  it('grows towards the pointer from the right edge', () => {
    expect(sizeFromPointer(900, IPAD_LONG)).toBe(466)
    expect(sizeFromPointer(700, IPAD_LONG)).toBeGreaterThan(sizeFromPointer(900, IPAD_LONG))
  })

  it('never reports a negative size when dragged past the edge', () => {
    expect(sizeFromPointer(1500, IPAD_LONG)).toBe(0)
  })
})
