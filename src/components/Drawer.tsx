import { mdiClose, mdiUnfoldMoreVertical } from '@mdi/js'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { readDrawerSize, writeDrawerSize } from '../data/uiPrefs'
import {
  clampDrawerSize,
  defaultDrawerSize,
  drawerBounds,
  resolveDrawerRelease,
  sizeForMode,
  sizeFromPointer,
  trackerMinHeight,
  TRACKER_MIN_WIDTH,
  type DrawerMode,
  type DrawerSide,
} from '../lib/drawer'
import { Icon } from './Icon'

/**
 * Rough row and dock heights, used only to derive the portrait drawer's upper
 * bound ("five rows stay visible"). Measuring the real row would tie the bound
 * to whether the tracker happens to be empty, and being a few pixels out here
 * costs nothing — the bound is a floor on readability, not a layout value.
 */
const ROW_HEIGHT = 118
const DOCK_HEIGHT = 72

/** Landscape → from the right, portrait → from the bottom. Derived from the
 *  media query rather than stored, so rotating the iPad is not a state change. */
function useDrawerSide(): DrawerSide {
  const [side, setSide] = useState<DrawerSide>(() =>
    typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches ? 'bottom' : 'right',
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(orientation: portrait)')
    const update = () => setSide(query.matches ? 'bottom' : 'right')
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return side
}

export interface DrawerState {
  side: DrawerSide
  mode: DrawerMode
  /** Rendered size along the drawer's axis, in px. 0 when closed. */
  size: number
  /** Live size during a drag; the drawer floats at this size without reflowing
   *  the tracker until the gesture ends. */
  dragSize: number | null
  open: () => void
  close: () => void
  toggle: () => void
  startDrag: (e: React.PointerEvent) => void
  nudge: (delta: number) => void
}

/**
 * Owns the drawer's mode and size. `host` is the element the drawer shares with
 * the tracker — its box is the extent the bounds are derived from.
 *
 * It is passed as an element rather than a ref on purpose: the host does not
 * exist during the pre-hydration render, and a ref object is referentially
 * stable, so the measuring effect would never re-run once it appeared. Held as
 * state (`ref={setShell}`), the element's arrival is itself the trigger.
 */
export function useDrawer(host: HTMLElement | null): DrawerState {
  const side = useDrawerSide()
  const [extent, setExtent] = useState(0)
  const [mode, setMode] = useState<DrawerMode>('closed') // always starts closed
  const [docked, setDocked] = useState<number | null>(null)
  const [dragSize, setDragSize] = useState<number | null>(null)

  useEffect(() => {
    if (!host) return
    const measure = () => setExtent(side === 'right' ? host.clientWidth : host.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [host, side])

  // Each axis remembers its own size, so rotating does not carry a width over
  // as a height. Re-read on every side change rather than caching both.
  useEffect(() => {
    let live = true
    setDocked(null)
    readDrawerSize(side)
      .then((stored) => {
        if (live && stored !== null) setDocked(stored)
      })
      .catch((err: unknown) => console.error('drawer size read failed:', err))
    return () => {
      live = false
    }
  }, [side])

  const trackerMin = side === 'right' ? TRACKER_MIN_WIDTH : trackerMinHeight(ROW_HEIGHT, DOCK_HEIGHT)
  const bounds = drawerBounds(extent, trackerMin)
  const dockedSize = docked ?? defaultDrawerSize(extent, trackerMin)
  const size = sizeForMode(mode, dockedSize, bounds)

  const remember = useCallback(
    (next: number) => {
      setDocked(next)
      writeDrawerSize(side, next).catch((err: unknown) => console.error('drawer size write failed:', err))
    },
    [side],
  )

  const [dragging, setDragging] = useState(false)
  // The move handler runs on every frame of the gesture; keeping what it needs
  // in a ref means the listeners are attached once per drag rather than once per
  // pixel of movement.
  const live = useRef({ side, bounds, dockedSize, dragSize })
  live.current = { side, bounds, dockedSize, dragSize }

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      // Pointer capture plus `touch-action: none` on the handle: the list's
      // dnd-kit TouchSensor is listening 200ms deep on the same surface, and
      // without capture the two gestures fight over the same finger.
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragSize(size)
      setDragging(true)
    },
    [size],
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      if (!host) return
      const box = host.getBoundingClientRect()
      const horizontal = live.current.side === 'right'
      setDragSize(sizeFromPointer(horizontal ? e.clientX : e.clientY, horizontal ? box.right : box.bottom))
    }
    const onUp = () => {
      const { dragSize: final, bounds: b, dockedSize: previous } = live.current
      setDragging(false)
      setDragSize(null)
      if (final === null) return
      const release = resolveDrawerRelease(final, b, previous)
      setMode(release.mode)
      if (release.docked !== previous) remember(release.docked)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, host, remember])

  /** Keyboard resizing, so the handle is not a mouse-only control. */
  const nudge = useCallback(
    (delta: number) => {
      const next = clampDrawerSize(size + delta, bounds)
      setMode('docked')
      remember(next)
    },
    [size, bounds, remember],
  )

  return {
    side,
    mode,
    size,
    dragSize,
    open: useCallback(() => setMode((m) => (m === 'closed' ? 'docked' : m)), []),
    close: useCallback(() => setMode('closed'), []),
    toggle: useCallback(() => setMode((m) => (m === 'closed' ? 'docked' : 'closed')), []),
    startDrag,
    nudge,
  }
}

interface DrawerProps {
  state: DrawerState
  title: string
  /**
   * Whether the drawer supplies its own close button. Off when the content puts
   * one in its own controls — the statblock groups Close with Edit and Pin, where
   * the three read as one set rather than as two styles in two corners.
   */
  ownClose?: boolean
  children: ReactNode
}

/**
 * The reference surface: statblocks now, the compendium later. It is a drawer
 * rather than a flex sibling because "what I am looking up" is not always
 * on-screen — and when it is, how much room it deserves is the DM's call, not a
 * ratio baked into the layout.
 *
 * Docked it is inset, taking room from the tracker. While the handle is being
 * dragged it floats over the tracker instead, so the rows reflow once on
 * release rather than on every frame of the gesture.
 */
export function Drawer({ state, title, ownClose = true, children }: DrawerProps) {
  const { side, mode, size, dragSize } = state
  const dragging = dragSize !== null
  const axis = side === 'right' ? 'width' : 'height'
  const closed = mode === 'closed' && !dragging

  return (
    <aside
      className={`drawer drawer-${side} ${dragging ? 'dragging' : ''} ${closed ? 'closed' : ''}`}
      // The drawer keeps its committed size for the whole gesture; the live size
      // is shown by the preview below, which floats over the tracker. That is
      // what makes the rows reflow once, on release, instead of every frame.
      style={{ [axis]: `${size}px` }}
      aria-hidden={closed}
      aria-label={title}
    >
      {dragging && (
        <div className="drawer-preview" style={{ [axis]: `${dragSize}px` }} aria-hidden="true">
          <span className="drawer-preview-edge" />
        </div>
      )}
      <div
        className="drawer-handle"
        role="separator"
        tabIndex={0}
        aria-label={`Resize ${title}`}
        aria-orientation={side === 'right' ? 'vertical' : 'horizontal'}
        onPointerDown={state.startDrag}
        onKeyDown={(e) => {
          const grow = side === 'right' ? 'ArrowLeft' : 'ArrowUp'
          const shrink = side === 'right' ? 'ArrowRight' : 'ArrowDown'
          if (e.key === grow) state.nudge(48)
          else if (e.key === shrink) state.nudge(-48)
          else return
          e.preventDefault()
        }}
      >
        <Icon path={mdiUnfoldMoreVertical} />
      </div>
      <div className="drawer-body">
        {ownClose && (
          <button
            type="button"
            className="icon-only drawer-close"
            aria-label={`Close ${title}`}
            title={`Close ${title}`}
            onClick={state.close}
          >
            <Icon path={mdiClose} />
          </button>
        )}
        {children}
      </div>
    </aside>
  )
}
