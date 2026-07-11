import { useState } from 'react'
import { evalArithmetic } from '../lib/arithmetic'

interface DamageHealInputProps {
  combatantName: string
  onApply: (amount: number, heal: boolean) => void
}

/** Quick HP delta: "+10" + Enter heals 10, "-10" (or "10") + Enter damages 10. */
export function DamageHealInput({ combatantName, onApply }: DamageHealInputProps) {
  const [text, setText] = useState('')

  const apply = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const value = evalArithmetic(trimmed)
    if (value === null || value === 0) {
      setText('')
      return
    }
    onApply(Math.abs(value), trimmed.startsWith('+') && value > 0)
    setText('')
  }

  return (
    <input
      className="hp-delta"
      type="text"
      inputMode="numeric"
      placeholder="±HP"
      value={text}
      aria-label={`Damage or heal ${combatantName} (+ heals, − damages)`}
      title="+10 heals 10, -10 damages 10 (Enter to apply)"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => setText('')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') apply()
        if (e.key === 'Escape') setText('')
      }}
    />
  )
}
