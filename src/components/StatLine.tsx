import type { ReactNode } from 'react'

export interface Stat {
  label: string
  value: ReactNode
}

/**
 * The compact hairline stat line: label/value pairs between two rules. It is
 * the most repeated pattern in the app — the statblock header and the spell,
 * item and creature sheets all open with one, so chips and separate price or
 * component lines were folded into it.
 *
 * Entries with a nullish value are dropped, so callers can list every field a
 * kind of entry might carry without guarding each one.
 */
export function StatLine({ stats }: { stats: (Stat | false | '' | null | undefined)[] }) {
  const shown = stats.filter((s): s is Stat => !!s && s.value !== null && s.value !== undefined && s.value !== '')
  if (shown.length === 0) return null
  return (
    <div className="statline">
      {shown.map((s) => (
        <div key={s.label}>
          <span className="statline-label">{s.label}</span>
          <span className="statline-value">{s.value}</span>
        </div>
      ))}
    </div>
  )
}
