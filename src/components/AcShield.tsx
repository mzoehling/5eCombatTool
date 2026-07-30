/** MDI `shield` (solid). Inlined rather than imported so the number can be
 *  absolutely centred inside the same box. */
const SHIELD_PATH = 'M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z'

interface AcShieldProps {
  value: number
  className?: string
}

/** Armour class as a filled shield with the value inside it. */
export function AcShield({ value, className }: AcShieldProps) {
  return (
    <span className={className ? `ac-shield ${className}` : 'ac-shield'} title={`Armor Class ${value}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={SHIELD_PATH} fill="currentColor" />
      </svg>
      <span className="ac-shield-value num">{value}</span>
    </span>
  )
}
