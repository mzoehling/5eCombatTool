import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { mdiDiceD20, mdiDrag, mdiEyeOff, mdiFormatListChecks } from '@mdi/js'
import { battleStore } from '../store/battleStore'
import { d20 } from '../lib/dice'
import { healthStatus } from '../lib/healthStage'
import { hpMeterStyle } from '../lib/hpMeter'
import type { AoeFactor, AoeStep } from '../store/trackerUi'
import type { Combatant } from '../types'
import { AcShield } from './AcShield'
import { AoeFactorPicker } from './AoeFactorPicker'
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
  /** Which of the three AoE steps the bar is on; only read while `multiSelect`. */
  aoeStep?: AoeStep
  /** On the Apply step: what this row would receive, `null` until it is known.
   *  Dice notation has no number until it is rolled, so it stays null there. */
  aoeResult?: number | null
  /** This row's factor, and the arithmetic behind the number above. */
  aoeFactor?: AoeFactor
  onFactorChange?: (factor: AoeFactor) => void
  /** Set once the AoE bar has rolled: this row's total and how it read. */
  aoeSave?: { total: number; verdict: 'saved' | 'failed' }
  onToggleSave?: () => void
  onSelect: () => void
  onToggleCheck: () => void
  onEditConditions: () => void
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
  aoeStep = 'select',
  aoeResult,
  aoeFactor = 1,
  onFactorChange,
  aoeSave,
  onToggleSave,
  onSelect,
  onToggleCheck,
  onEditConditions,
}: CombatantRowProps) {
  const { dispatch } = battleStore
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled: !isTied,
  })

  const stage = healthStatus(c.hp, c.maxHp)
  const classes = [
    'combatant-row',
    `hp-${stage.toLowerCase()}`,
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

  // Health reads as two layers: a low tint of the stage colour over the whole
  // row (`background-color`) and an exact 4px meter along its bottom edge
  // (`background-image`), so nothing is ever painted behind the text. Temp HP
  // extends the meter's scale rather than being drawn inside the max: 20 temp
  // on 90/100 is 20 points, and the bar has to say so.
  const hpStyle = hpMeterStyle(c.hp, c.maxHp, c.tempHp)

  return (
    <li
      ref={setNodeRef}
      className={classes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...hpStyle,
      }}
    >
      {/* The checkbox takes over the initiative block's footprint so nothing
          else in the row shifts when AoE mode is toggled. */}
      {multiSelect ? (
        <label className="row-check-block">
          <Checkbox checked={checked} onChange={onToggleCheck} ariaLabel={`Select ${c.name}`} />
          <span className="row-check-caption">{checked ? 'in area' : 'spared'}</span>
        </label>
      ) : (
        <div className={showRoll ? 'init-block with-roll' : 'init-block'}>
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
        {/* Chips sit on the name's line now that the meter is the row itself —
            they are what the name is qualified by, and a line of their own cost
            the row 40px of height. */}
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

      {/* One button, to the conditions. Editing a combatant is not a mid-combat
          action and lives in the statblock header instead — the row's right side
          is for the numbers the DM changes while the fight runs. */}
      <button type="button" className="ghost cond-btn" aria-label={`Conditions for ${c.name}`} onClick={onEditConditions}>
        <Icon path={mdiFormatListChecks} />
      </button>

      {/* AC drops on the Apply step and only there. It is what the DM reads
          while deciding who is caught and how they rolled; by the time the
          question is "what does this do to them" it is three chips' worth of
          width spent on a number nobody is looking at any more. */}
      {!(multiSelect && aoeStep === 'apply') && <AcShield value={c.armorClass} />}

      {/* While AoE is armed the HP fields give way to what that step needs:
          nothing is typed per row when you are picking targets. Current health
          stays on every step — on Apply it is what the result is estimated
          against. The footprint is shared so arming AoE shifts nothing. */}
      {multiSelect ? (
        <div className={`hp-block aoe-block aoe-${aoeStep}`}>
          <span className="hp-values dim num">
            {c.hp}/{c.maxHp}
            {c.tempHp > 0 && aoeStep === 'select' && <span className="aoe-temp"> +{c.tempHp}</span>}
          </span>

          {/* Tapping the result flips it, for a player who rolled their own. */}
          {aoeStep !== 'select' && aoeSave && (
            <button
              type="button"
              className={`aoe-verdict ${aoeSave.verdict}`}
              title={`${aoeSave.total} against the DC — tap to flip`}
              aria-label={`${c.name} ${aoeSave.verdict} — tap to flip`}
              onClick={onToggleSave}
            >
              <span className="aoe-verdict-roll num">{aoeSave.total}</span> ·{' '}
              {aoeSave.verdict === 'saved' ? 'save' : 'fail'}
            </button>
          )}

          {/* Factor and the hp result it produces, side by side: the second is
              the first's consequence, and the DM changes one to read the other. */}
          {aoeStep === 'apply' && (
            <>
              <AoeFactorPicker
                value={aoeFactor}
                combatantName={c.name}
                onPick={(f) => onFactorChange?.(f)}
              />
              <span className="aoe-hp-result num">
                {aoeResult === null || aoeResult === undefined ? '—' : `±${aoeResult} hp`}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="hp-block">
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
          <DamageHealInput
            combatantName={c.name}
            onApply={(amount, heal) => dispatch({ type: heal ? 'applyHealing' : 'applyDamage', ids: [c.id], amount })}
          />
        </div>
      )}
    </li>
  )
}
