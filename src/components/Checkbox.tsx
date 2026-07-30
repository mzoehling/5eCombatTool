import { mdiCheck } from '@mdi/js'
import { Icon } from './Icon'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  ariaLabel: string
  className?: string
}

/**
 * 32px checkbox. The native control is kept for semantics and keyboard use but
 * hidden; the visible box is the span next to it, because a native checkbox is
 * too small to hit reliably with an Apple Pencil.
 */
export function Checkbox({ checked, onChange, ariaLabel, className }: CheckboxProps) {
  return (
    <>
      <input
        type="checkbox"
        className={className ? `checkbox ${className}` : 'checkbox'}
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <span className="checkbox-box" aria-hidden="true">
        <Icon path={mdiCheck} size={20} />
      </span>
    </>
  )
}
