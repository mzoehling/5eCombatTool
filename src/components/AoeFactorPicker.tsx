import { mdiChevronDown } from '@mdi/js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AoeFactor } from '../store/trackerUi'
import { Icon } from './Icon'

/**
 * The five multipliers, in the order they run.
 *
 * Five, not two: half-on-a-save is only one of the adjustments a DM makes at
 * this moment, and resistance, vulnerability and immunity are the same
 * arithmetic on a different number. Offering them together is what turns "the
 * fire genasi is immune" into one tap instead of a separate ±HP edit after the
 * area has already been applied to everyone.
 */
export const AOE_FACTORS: { value: AoeFactor; label: string; title: string }[] = [
  { value: 0, label: '×0', title: 'Immune — nothing applies' },
  { value: 0.25, label: '×¼', title: 'Resistant and saved' },
  { value: 0.5, label: '×½', title: 'Saved, or resistant' },
  { value: 1, label: '×1', title: 'Full' },
  { value: 2, label: '×2', title: 'Vulnerable' },
]

function labelFor(factor: AoeFactor): string {
  return AOE_FACTORS.find((f) => f.value === factor)?.label ?? '×1'
}

interface AoeFactorPickerProps {
  value: AoeFactor
  combatantName: string
  onPick: (factor: AoeFactor) => void
}

/**
 * A row's factor chip, and the popover behind it.
 *
 * One component owns both because the chip is the popover's anchor *and* its
 * toggle: with the two separate, a press on the chip is "outside" the popover,
 * so dismissing it closed and the chip's own handler reopened it in the same
 * gesture. Nested, the chip is inside the ref and the toggle is simply a toggle.
 *
 * A popover rather than a modal: this is a five-way choice about one row, and a
 * centred dialog would put the DM's own selection behind a backdrop at the exact
 * moment they are reading it.
 */
/** Roughly how tall the popover is, used to decide which side of the chip it
 *  opens on before it has been laid out and can be measured. */
const POPOVER_HEIGHT = 60

export function AoeFactorPicker({ value, combatantName, onPick }: AoeFactorPickerProps) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // Positioned against the viewport, from the chip's own rect, and rendered into
  // `document.body`. Anchoring it to the chip with `position: absolute` is the
  // obvious thing and it does not work here: the rows live in a scrolling list,
  // which clips anything that reaches past its edges, so the popover on the top
  // row opened underneath the top bar and could not be pressed at all.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const chip = chipRef.current?.getBoundingClientRect()
      if (!chip) return
      const height = popRef.current?.offsetHeight ?? POPOVER_HEIGHT
      // Above the chip by default, so the DM's own finger is not covering the
      // row being decided; below it when there is no room above.
      const above = chip.top - height - 8
      setAt({ left: chip.right, top: above >= 8 ? above : chip.bottom + 8 })
    }
    place()
    // A scroll moves the chip out from under it, so the popover follows rather
    // than being left pointing at a different creature.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // The chip counts as inside: it is the toggle, and treating a press on it as
    // "outside" meant dismissing the popover closed it and the chip's own
    // handler reopened it in the same gesture.
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !chipRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onOutside)
    }
  }, [open])

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className="aoe-factor-chip"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Factor for ${combatantName}: ${labelFor(value)}`}
        onClick={() => setOpen((o) => !o)}
      >
        {labelFor(value)}
        <Icon path={mdiChevronDown} size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="aoe-factor-popover"
            role="group"
            aria-label={`Factor for ${combatantName}`}
            style={at ? { left: at.left, top: at.top } : { visibility: 'hidden' }}
          >
            {AOE_FACTORS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={f.value === value ? 'aoe-factor-option primary' : 'aoe-factor-option'}
                title={f.title}
                aria-pressed={f.value === value}
                onClick={() => {
                  onPick(f.value)
                  setOpen(false)
                }}
              >
                {f.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
