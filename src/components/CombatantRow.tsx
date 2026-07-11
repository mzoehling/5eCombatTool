import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { mdiDiceD20, mdiDotsHorizontal, mdiDrag, mdiEyeOff, mdiFormatListChecks, mdiShieldOutline } from '@mdi/js'
import { battleStore } from '../store/battleStore'
import { d20 } from '../lib/dice'
import type { Combatant } from '../types'
import { DamageHealInput } from './DamageHealInput'
import { HpInput } from './HpInput'
import { Icon } from './Icon'

interface CombatantRowProps {
  combatant: Combatant
  isActiveTurn: boolean
  isSelected: boolean
  isTied: boolean
  multiSelect: boolean
  checked: boolean
  groupName?: string
  groupColor?: string
  groupOut: boolean
  onSelect: () => void
  onToggleCheck: () => void
  onEditConditions: () => void
  onEdit: () => void
}

function hpClass(c: Combatant): string {
  if (c.hp <= 0) return 'hp-down'
  const ratio = c.hp / Math.max(1, c.maxHp)
  if (ratio <= 0.25) return 'hp-critical'
  if (ratio <= 0.5) return 'hp-bloodied'
  return 'hp-ok'
}

export function CombatantRow({
  combatant: c,
  isActiveTurn,
  isSelected,
  isTied,
  multiSelect,
  checked,
  groupName,
  groupColor,
  groupOut,
  onSelect,
  onToggleCheck,
  onEditConditions,
  onEdit,
}: CombatantRowProps) {
  const { dispatch } = battleStore
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled: !isTied,
  })

  const classes = [
    'combatant-row',
    hpClass(c),
    isActiveTurn ? 'active-turn' : '',
    isSelected ? 'selected' : '',
    groupOut || !c.isActive ? 'out-of-battle' : '',
    isDragging ? 'dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // the roll button only shows while initiative is unset (0/null); any
  // entered or rolled value hides it
  const showRoll = (c.initiative ?? 0) === 0

  return (
    <li
      ref={setNodeRef}
      className={classes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {multiSelect && (
        <input
          type="checkbox"
          className="row-check"
          checked={checked}
          onChange={onToggleCheck}
          aria-label={`Select ${c.name}`}
        />
      )}

      <div className="init-block">
        <HpInput
          className="init-value"
          value={c.initiative ?? 0}
          ariaLabel={`${c.name} initiative`}
          onCommit={(v) => dispatch({ type: 'setInitiative', id: c.id, initiative: v })}
        />
        {showRoll && (
          <button
            type="button"
            className="ghost roll-btn"
            aria-label={`Roll initiative for ${c.name}`}
            title={`d20 ${c.initiativeBonus >= 0 ? '+' : ''}${c.initiativeBonus}`}
            onClick={() => dispatch({ type: 'rollInitiative', ids: [c.id], rolls: [d20()] })}
          >
            <Icon path={mdiDiceD20} />
          </button>
        )}
      </div>

      <button type="button" className="row-main" onClick={onSelect}>
        <span className="row-name">
          {c.hiddenFromPlayers && (
            <span title="Hidden from players">
              <Icon path={mdiEyeOff} size={16} className="dim-icon" />{' '}
            </span>
          )}
          {c.name}
          {c.isPC && <span className="badge pc">PC</span>}
          {groupName && (
            <span
              className="badge group"
              style={
                groupColor
                  ? { background: `color-mix(in srgb, ${groupColor} 28%, transparent)`, color: groupColor }
                  : undefined
              }
            >
              {groupName}
            </span>
          )}
        </span>
        {c.conditions.length > 0 && (
          <span className="row-conditions">
            {c.conditions.map((cond) => (
              <span key={cond.condition} className="chip">
                {cond.condition === 'Exhaustion' ? `Exhaustion ${cond.level ?? 1}` : cond.condition}
                {cond.remainingRounds !== undefined && ` (${cond.remainingRounds})`}
              </span>
            ))}
          </span>
        )}
      </button>

      <button type="button" className="ghost cond-btn" aria-label={`Conditions for ${c.name}`} onClick={onEditConditions}>
        <Icon path={mdiFormatListChecks} />
      </button>

      <div className="hp-block">
        <div className="hp-values">
          <HpInput
            className="hp-current"
            value={c.hp}
            ariaLabel={`${c.name} current HP`}
            onCommit={(v) => dispatch({ type: 'updateCombatant', id: c.id, patch: { hp: Math.max(0, Math.min(c.maxHp, v)) } })}
          />
          <span className="hp-max">/{c.maxHp}</span>
          <HpInput
            className="hp-temp"
            value={c.tempHp}
            ariaLabel={`${c.name} temp HP`}
            onCommit={(v) => dispatch({ type: 'updateCombatant', id: c.id, patch: { tempHp: Math.max(0, v) } })}
          />
        </div>
        <DamageHealInput
          combatantName={c.name}
          onApply={(amount, heal) => dispatch({ type: heal ? 'applyHealing' : 'applyDamage', ids: [c.id], amount })}
        />
      </div>

      <span className="ac-badge" title="Armor Class">
        <Icon path={mdiShieldOutline} size={15} className="dim-icon" />
        {c.armorClass}
      </span>

      <button type="button" className="ghost edit-btn" aria-label={`Edit ${c.name}`} onClick={onEdit}>
        <Icon path={mdiDotsHorizontal} />
      </button>

      {isTied && (
        <button type="button" className="ghost drag-handle" aria-label={`Reorder ${c.name}`} {...attributes} {...listeners}>
          <Icon path={mdiDrag} />
        </button>
      )}
    </li>
  )
}
