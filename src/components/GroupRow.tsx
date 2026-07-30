import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import type { Combatant, Group } from '../types'
import { Icon } from './Icon'

interface GroupRowProps {
  group: Group
  members: Combatant[]
  /** True while any member of this run holds the turn. */
  hasActiveTurn: boolean
  onExpand: () => void
}

/**
 * A collapsed run of one group, standing in for its members.
 *
 * Eight goblins eat half the screen and the DM reads them as one thing anyway,
 * so a collapsed run shows the group once: how many are still up, the pooled HP
 * left, and the initiative they share. Tapping it expands the run back into
 * ordinary rows.
 *
 * Whoever is acting is never hidden — TrackerPane renders the active member as
 * a full row alongside this one, so a collapsed group can still be played from.
 */
export function GroupRow({ group, members, hasActiveTurn, onExpand }: GroupRowProps) {
  const standing = members.filter((c) => c.hp > 0).length
  const hp = members.reduce((sum, c) => sum + Math.max(0, c.hp), 0)
  const maxHp = members.reduce((sum, c) => sum + c.maxHp, 0)
  const percent = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))
  const ratio = hp / Math.max(1, maxHp)
  const fill = ratio > 0.5 ? 'hp-ok' : ratio > 0.25 ? 'hp-bloodied' : hp > 0 ? 'hp-critical' : 'hp-down'
  const initiative = members[0].initiative ?? 0

  return (
    <li className={`combatant-row group-row ${fill}${hasActiveTurn ? ' active-turn' : ''}`}>
      <div className="init-block">
        <span className="init-value num group-init">{initiative}</span>
      </div>

      <button
        type="button"
        className="row-main"
        aria-expanded={false}
        aria-label={`Expand ${group.name} (${members.length} members)`}
        onClick={onExpand}
      >
        <span className="row-name">
          <Icon path={mdiChevronRight} size={18} className="dim-icon" />
          <span className="row-name-text">{group.name}</span>
          <span className="badge group" style={group.color ? { background: group.color, color: '#fff' } : undefined}>
            ×{members.length}
          </span>
          {standing < members.length && (
            <span className="dim group-standing">
              {standing} up, {members.length - standing} down
            </span>
          )}
        </span>
        <span className="hp-meter">
          <span className="hp-meter-fill" style={{ width: `${percent}%` }} />
        </span>
      </button>

      <span className="group-hp num">
        {hp}/{maxHp}
      </span>

      <button type="button" className="ghost cond-btn" aria-label={`Expand ${group.name}`} onClick={onExpand}>
        <Icon path={mdiChevronDown} />
      </button>
    </li>
  )
}
