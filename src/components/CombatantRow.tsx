import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { mdiDiceD20, mdiDotsHorizontal, mdiDrag, mdiEyeOff, mdiFormatListChecks } from '@mdi/js'
import { battleStore } from '../store/battleStore'
import { d20 } from '../lib/dice'
import type { Combatant } from '../types'
import { AcShield } from './AcShield'
import { Checkbox } from './Checkbox'
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
  /** While AoE is armed: what this row would receive if it were applied now. */
  aoePreview?: { amount: number; heal: boolean }
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
  aoePreview,
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
    multiSelect ? (checked ? 'aoe-selected' : 'aoe-unselected') : '',
  ]
    .filter(Boolean)
    .join(' ')

  // the roll button only shows while initiative is unset (0/null); any
  // entered or rolled value hides it
  const showRoll = (c.initiative ?? 0) === 0

  const hpPercent = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.maxHp)) * 100))
  // Temp HP hangs off the end of the fill rather than being counted into it,
  // so the bar still reads as "how much of your own HP is left".
  const tempPercent = Math.min(100 - hpPercent, (c.tempHp / Math.max(1, c.maxHp)) * 100)

  return (
    <li
      ref={setNodeRef}
      className={classes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* The checkbox takes over the initiative block's footprint so nothing
          else in the row shifts when AoE mode is toggled. */}
      {multiSelect ? (
        <label className="row-check-block">
          <Checkbox checked={checked} onChange={onToggleCheck} ariaLabel={`Select ${c.name}`} />
          <span className="row-check-caption">{checked ? 'in area' : 'spared'}</span>
        </label>
      ) : (
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
      )}

      {/* Only rows tied with a neighbour can be reordered by hand, so the handle
          only exists then — the rest of the time it would just eat width. */}
      {isTied && (
        <button
          type="button"
          className="ghost drag-handle"
          aria-label={`Reorder ${c.name}`}
          title="Drag to reorder within tied initiative"
          {...attributes}
          {...listeners}
        >
          <Icon path={mdiDrag} />
        </button>
      )}

      <button type="button" className="row-main" onClick={onSelect}>
        <span className="row-name">
          {c.hiddenFromPlayers && (
            <span title="Hidden from players">
              <Icon path={mdiEyeOff} size={16} className="dim-icon" />{' '}
            </span>
          )}
          <span className="row-name-text">{c.name}</span>
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
        <span className="hp-meter">
          <span className="hp-meter-fill" style={{ width: `${hpPercent}%` }} />
          {tempPercent > 0 && (
            <span className="hp-meter-temp" style={{ left: `${hpPercent}%`, width: `${tempPercent}%` }} />
          )}
        </span>
        {c.conditions.length > 0 && (
          <span className="row-conditions">
            {c.conditions.map((cond) => (
              <span
                key={cond.condition}
                className={cond.condition === 'Concentration' ? 'chip concentration' : 'chip'}
              >
                {cond.condition === 'Exhaustion' ? `Exhaustion ${cond.level ?? 1}` : cond.condition}
                {cond.remainingRounds !== undefined && ` (${cond.remainingRounds})`}
              </span>
            ))}
          </span>
        )}
      </button>

      {aoePreview && (
        <span className={aoePreview.heal ? 'aoe-preview heal' : 'aoe-preview'}>
          {aoePreview.heal ? '+' : '−'}
          {aoePreview.amount} hp
        </span>
      )}

      <button type="button" className="ghost cond-btn" aria-label={`Conditions for ${c.name}`} onClick={onEditConditions}>
        <Icon path={mdiFormatListChecks} />
      </button>

      <AcShield value={c.armorClass} />

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

      <button type="button" className="ghost edit-btn" aria-label={`Edit ${c.name}`} onClick={onEdit}>
        <Icon path={mdiDotsHorizontal} />
      </button>
    </li>
  )
}
