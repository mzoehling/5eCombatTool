import { useEffect, useState } from 'react'
import { evalArithmetic } from '../lib/arithmetic'

interface HpInputProps {
  value: number
  onCommit: (value: number) => void
  ariaLabel: string
  className?: string
}

/** Numeric input that accepts arithmetic ("10+3" → 13) on blur/enter. */
export function HpInput({ value, onCommit, ariaLabel, className }: HpInputProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const result = evalArithmetic(text)
    if (result === null) setText(String(value))
    else if (result !== value) onCommit(result)
    else setText(String(value))
  }

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(String(value))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
