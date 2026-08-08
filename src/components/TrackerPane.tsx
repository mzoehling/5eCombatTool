import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { mdiCheckAll, mdiChevronDown, mdiChevronLeft, mdiDiceD20, mdiDiceMultiple, mdiVectorCircle } from '@mdi/js'
import { Fragment, useEffect, useState } from 'react'
import { evalArithmetic } from '../lib/arithmetic'
import { d20 } from '../lib/dice'
import { rollDiceExpression } from '../lib/diceExpr'
import { battleStore, useBattleState } from '../store/battleStore'
import { sortedCombatants } from '../store/battleReducer'
import { groupedInitiativeRolls, groupRuns } from '../lib/groups'
import { amountWithFactor, readSave, SAVE_ABILITIES, saveBonus } from '../lib/saves'
import type { AoeFactor, AoeResult, AoeStep } from '../store/trackerUi'
import type { Ability, Combatant } from '../types'
import { AssignGroup } from './AssignGroup'
import { CombatantRow } from './CombatantRow'
import { GroupRow } from './GroupRow'
import { ConditionsDialog } from './ConditionsDialog'
import { DiceRoller } from './DiceRoller'
import { Icon } from './Icon'

interface TrackerPaneProps {
  selectedId: string | null
  onSelect: (id: string) => void
  /** AoE multi-select state is owned by App (shared with the statblock panel). */
  multiSelect: boolean
  onArmAoe: () => void
  /** Leaves AoE mode and resets the bar — see store/trackerUi.ts. */
  onExitAoe: () => void
  checked: ReadonlySet<string>
  onCheckedChange: (checked: ReadonlySet<string>) => void
  /** The AoE amount field. Owned by App because the dice roller writes into it,
   *  and the roller is opened from the statblock as well as from this dock. */
  aoeAmount: string
  onAoeAmountChange: (amount: string) => void
  /** Puts a rolled total into the AoE bar and arms it. Owned by App because the
   *  statblock's dice links open the same roller. */
  onSendRollToAoe: (amount: number) => void
  /** The stepper's position and everything the three steps hold. All of it lives
   *  in the tracker UI store rather than here, so leaving AoE clears it in one
   *  action and nothing survives into the next area effect. */
  aoeStep: AoeStep
  onAoeStep: (step: AoeStep) => void
  aoeSaveAbility: Ability | null
  aoeSaveDc: string
  onAoeSave: (save: { ability?: Ability | null; dc?: string }) => void
  aoeResults: Readonly<Record<string, AoeResult>>
  onAoeResults: (results: Readonly<Record<string, AoeResult>>) => void
  onFlipAoeResult: (id: string) => void
  aoeFactors: Readonly<Record<string, AoeFactor>>
  onAoeFactor: (id: string, factor: AoeFactor) => void
}

/** The three steps, in order, with what the advance button reads on each. */
const AOE_STEPS: { id: AoeStep; name: string; advance: string | null }[] = [
  { id: 'select', name: 'Select', advance: 'Save ›' },
  { id: 'save', name: 'Save', advance: 'Apply ›' },
  { id: 'apply', name: 'Apply', advance: null },
]

export function TrackerPane({
  selectedId,
  onSelect,
  multiSelect,
  onArmAoe,
  onExitAoe,
  checked,
  onCheckedChange,
  aoeAmount,
  onAoeAmountChange,
  onSendRollToAoe,
  aoeStep,
  onAoeStep,
  aoeSaveAbility,
  aoeSaveDc,
  onAoeSave,
  aoeResults,
  onAoeResults,
  onFlipAoeResult,
  aoeFactors,
  onAoeFactor,
}: TrackerPaneProps) {
  const { dispatch } = battleStore
  const state = useBattleState()
  const [showDice, setShowDice] = useState(false)
  // One dialog for conditions, whether it is aimed at one row or at the whole
  // AoE selection — the write model differs, the surface does not.
  const [conditionsFor, setConditionsFor] = useState<'selection' | string | null>(null)
  // The selection being grouped, frozen when the picker opens.
  const [groupFor, setGroupFor] = useState<ReadonlySet<string> | null>(null)
  // Collapsed by default: a group the DM never opens is a group they read as
  // one thing. Expansion is per run and lives in the UI, not in battle state.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const ordered = sortedCombatants(state.combatants)
  const groupById = new Map(state.battle.groups.map((g) => [g.id, g]))

  // ties: combatants sharing an initiative value with at least one other
  const initiativeCounts = new Map<number, number>()
  for (const c of ordered) {
    if (c.initiative !== null) initiativeCounts.set(c.initiative, (initiativeCounts.get(c.initiative) ?? 0) + 1)
  }
  /**
   * Rows that share an initiative value with a neighbour, which is the only case
   * where manual ordering means anything.
   *
   * Unrolled combatants sit at 0 (or null), so before initiative is rolled every
   * row "tied" with every other and the whole list grew reorder handles that
   * reordered nothing. An unset value is not a tie.
   */
  const isTied = (init: number | null) =>
    init !== null && init !== 0 && (initiativeCounts.get(init) ?? 0) > 1

  // auto-clear condition-expiry and turn-event notices
  useEffect(() => {
    if (!state.expiredConditions.length && !state.turnEvents.length) return
    const timer = setTimeout(() => dispatch({ type: 'clearExpiredNotice' }), 6000)
    return () => clearTimeout(timer)
  }, [state.expiredConditions, state.turnEvents, dispatch])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const activeIndex = ordered.findIndex((c) => c.id === active.id)
    const overIndex = ordered.findIndex((c) => c.id === over.id)
    if (activeIndex === -1 || overIndex === -1) return
    // ties only: both rows must share the initiative value
    if (ordered[activeIndex].initiative !== ordered[overIndex].initiative) return
    const beforeId =
      activeIndex < overIndex
        ? (ordered[overIndex + 1]?.id ?? null) // moving down → insert after `over`
        : over.id.toString() // moving up → insert before `over`
    dispatch({ type: 'reorder', id: active.id.toString(), beforeId })
  }

  /** What one target takes, given the area's amount and that target's factor. */
  const factorOf = (id: string): AoeFactor => aoeFactors[id] ?? 1

  const applyAoe = (heal: boolean) => {
    // Dice notation is rolled once for the whole area, which is what the rules
    // say: a fireball deals one damage roll to everyone it catches.
    const amount = evalArithmetic(aoeAmount) ?? rollDiceExpression(aoeAmount)?.total ?? null
    if (amount === null || amount <= 0 || checked.size === 0) return
    const type = heal ? ('applyHealing' as const) : ('applyDamage' as const)
    // Targets sharing a factor share an action — the reducer applies one amount
    // per action, with its own temp-HP handling per target either way. A factor
    // of ×0 produces nothing to apply, so those targets are simply left out
    // rather than dispatched a zero.
    //
    // Heal takes the factors too. A halved heal is not something the rules ask
    // for, but the factors are the DM's own answer about each row by the time
    // this button is reachable, and quietly ignoring them on one of the two
    // buttons would mean the chips said one thing and the log another.
    const byFactor = new Map<AoeFactor, string[]>()
    for (const id of checked) {
      const f = factorOf(id)
      if (amountWithFactor(amount, f) <= 0) continue
      byFactor.set(f, [...(byFactor.get(f) ?? []), id])
    }
    // One area effect, one undo: every group goes out as one batch.
    battleStore.dispatchAll(
      [...byFactor].map(([factor, ids]) => ({ type, ids, amount: amountWithFactor(amount, factor) })),
    )
    exitAoe()
  }

  /** Rolls a save for every checked combatant and reads it against the DC. */
  const rollSaves = () => {
    const dc = Number.parseInt(aoeSaveDc, 10)
    if (!aoeSaveAbility || !Number.isFinite(dc)) return
    const next: Record<string, AoeResult> = {}
    for (const c of ordered) {
      if (!checked.has(c.id)) continue
      const bonus = saveBonus(c, aoeSaveAbility)
      const roll = d20()
      next[c.id] = { total: roll + bonus, verdict: readSave(roll, bonus, dc) }
    }
    onAoeResults(next)
  }

  // NPCs whose initiative is still unset — PCs roll at the table
  const unrolledNpcs = state.combatants.filter((c) => !c.isPC && (c.initiative ?? 0) === 0)
  // One roll per group: six goblins roll once at a real table, not six times.
  const rollNpcs = () => {
    const { ids, rolls } = groupedInitiativeRolls(unrolledNpcs, d20)
    dispatch({ type: 'rollInitiative', ids, rolls })
  }

  /**
   * Leaving the AoE bar resets it entirely — targets, amount, step, rolls and
   * factors, all in one store action. Applying goes out this way too, so a
   * factor set for one fireball can never be waiting for the next.
   */
  const exitAoe = onExitAoe

  const toggleCheck = (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onCheckedChange(next)
  }

  const conditionTargets =
    conditionsFor === null
      ? []
      : conditionsFor === 'selection'
        ? ordered.filter((c) => checked.has(c.id))
        : state.combatants.filter((c) => c.id === conditionsFor)

  // What each row would receive, given the amount typed and that row's factor.
  // Only a usable number produces one — an empty, half-typed or dice-notation
  // field has no total until Apply is pressed, and the row shows an em dash
  // rather than a guess.
  //
  // The sign is `±`, the same as the row's own ±HP field, because the direction
  // genuinely is not known yet: the bar carries both Damage and Heal, and which
  // one is tapped is the DM's next decision. It used to render a hard `−` and a
  // danger-red pill, which told the DM they were about to hurt everyone selected
  // when they had typed a healing amount.
  const aoeValue = evalArithmetic(aoeAmount)
  const aoeTotal = aoeValue !== null && aoeValue > 0 ? aoeValue : null
  const resultFor = (id: string): number | null =>
    aoeTotal === null ? null : amountWithFactor(aoeTotal, factorOf(id))

  const stepIndex = AOE_STEPS.findIndex((s) => s.id === aoeStep)
  const step = AOE_STEPS[stepIndex]
  const allChecked = ordered.length > 0 && ordered.every((c) => checked.has(c.id))
  /** Back from step 1 is the way out of AoE mode entirely. */
  const stepBack = () => (stepIndex === 0 ? exitAoe() : onAoeStep(AOE_STEPS[stepIndex - 1].id))

  // A run is collapsed when its group is, it has more than one member, and AoE
  // is off — picking targets needs every row reachable.
  const runs = groupRuns(ordered)
  const renderRow = (c: Combatant) => {
    const group = c.groupId ? groupById.get(c.groupId) : undefined
    return (
                <CombatantRow
                  key={c.id}
                  combatant={c}
                  isActiveTurn={state.battle.isRunning && state.battle.activeCombatantId === c.id}
                  isSelected={selectedId === c.id}
                  isTied={isTied(c.initiative)}
                  multiSelect={multiSelect}
                  checked={checked.has(c.id)}
                  groupName={group?.name}
                  groupColor={group?.color}
                  groupOut={group ? !group.inBattle : false}
                  aoeStep={aoeStep}
                  aoeResult={checked.has(c.id) ? resultFor(c.id) : undefined}
                  aoeFactor={factorOf(c.id)}
                  onFactorChange={(f) => onAoeFactor(c.id, f)}
                  aoeSave={multiSelect && checked.has(c.id) ? aoeResults[c.id] : undefined}
                  onToggleSave={() => onFlipAoeResult(c.id)}
                  onSelect={() => onSelect(c.id)}
                  onToggleCheck={() => toggleCheck(c.id)}
                  onEditConditions={() => setConditionsFor(c.id)}
                />
    )
  }

  return (
    <section className="tracker-pane">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="combatant-list">
            {runs.map((run, i) => {
              const group = run.groupId ? groupById.get(run.groupId) : undefined
              const collapsed =
                !multiSelect && group !== undefined && run.members.length > 1 && !expandedGroups.has(run.groupId)
              if (!collapsed) {
                // Expanded: a slim header carries the way back. It cannot be
                // the group badge in the rows themselves — that badge sits
                // inside the row's own button, and a button inside a button is
                // not valid markup.
                const expandable = group !== undefined && run.members.length > 1
                return (
                  <Fragment key={`${run.groupId}-${i}`}>
                    {expandable && (
                      <li className="group-expanded-head">
                        <button
                          type="button"
                          className="ghost icon-label"
                          aria-expanded
                          onClick={() => {
                            const next = new Set(expandedGroups)
                            next.delete(run.groupId)
                            setExpandedGroups(next)
                          }}
                        >
                          <Icon path={mdiChevronDown} /> {group.name}
                        </button>
                      </li>
                    )}
                    {run.members.map(renderRow)}
                  </Fragment>
                )
              }
              if (!group) return run.members.map(renderRow)
              // Whoever is acting stays a full row, so a collapsed group can
              // still be played from without expanding it first.
              const active = state.battle.isRunning
                ? run.members.find((c) => c.id === state.battle.activeCombatantId)
                : undefined
              return (
                <Fragment key={`${run.groupId}-${i}`}>
                  <GroupRow
                    group={group}
                    members={run.members}
                    hasActiveTurn={active !== undefined}
                    onExpand={() => setExpandedGroups(new Set(expandedGroups).add(run.groupId))}
                  />
                  {active && renderRow(active)}
                </Fragment>
              )
            })}
            {ordered.length === 0 && <li className="empty-hint">No combatants — add creatures to begin.</li>}
          </ul>
        </SortableContext>
      </DndContext>

      {/* The dock is pinned below the list and holds the tools — turn control
          moved to the top bar, which cannot scroll either. In AoE mode the same
          strip becomes the AoE bar. Both stay the bottom layer of the pane: the
          drawer ends above them. */}
      {multiSelect ? (
        /* One skeleton for all three steps — Back, the counter, that step's
           controls, then the advance hard right — so the bar never moves under
           the DM's hand and never carries more than one decision's worth of
           controls. It carries no recap either: how many are selected and how
           each one rolled is written on the rows themselves. */
        <div className={`aoe-bar aoe-bar-${aoeStep}`}>
          <button type="button" className="ghost aoe-back icon-label" onClick={stepBack}>
            <Icon path={mdiChevronLeft} /> Back
          </button>
          <span className="aoe-step-count num">
            Step {stepIndex + 1} of {AOE_STEPS.length} · {step.name}
          </span>

          {aoeStep === 'select' && (
            <>
              {/* One toggle, not an All button beside a None button: the second
                  is only ever wanted right after the first. */}
              <button
                type="button"
                className="icon-label"
                onClick={() => onCheckedChange(allChecked ? new Set() : new Set(ordered.map((c) => c.id)))}
              >
                <Icon path={mdiCheckAll} /> {allChecked ? 'None' : 'All'}
              </button>
              <button type="button" disabled={checked.size === 0} onClick={() => setConditionsFor('selection')}>
                Condition…
              </button>
              {/* Opens the picker rather than acting: which group the selection
                  belongs in is the DM's answer to give, and pressing this twice
                  used to mean two new groups. */}
              <button
                type="button"
                disabled={checked.size === 0}
                title="Put this selection into a group"
                onClick={() => setGroupFor(new Set(checked))}
              >
                Group…
              </button>
            </>
          )}

          {aoeStep === 'save' && (
            <>
              {/* No visible label on the ability: the step counter beside it
                  already reads "SAVE", and the two together looked like a
                  stutter. The select carries the name for a screen reader. */}
              <label className="aoe-field">
                <select
                  aria-label="Save ability"
                  value={aoeSaveAbility ?? ''}
                  onChange={(e) => onAoeSave({ ability: (e.target.value || null) as Ability | null })}
                >
                  <option value="">—</option>
                  {SAVE_ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {a.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="aoe-field">
                DC
                <input
                  className="aoe-dc num"
                  inputMode="numeric"
                  aria-label="Save DC"
                  value={aoeSaveDc}
                  onChange={(e) => onAoeSave({ dc: e.target.value })}
                />
              </label>
              {/* Rolling for the table is optional — a result can be flipped by
                  hand for a player who rolled their own. */}
              <button
                type="button"
                className="icon-label"
                disabled={
                  checked.size === 0 || !aoeSaveAbility || !Number.isFinite(Number.parseInt(aoeSaveDc, 10))
                }
                onClick={rollSaves}
              >
                <Icon path={mdiDiceD20} /> Roll saves
              </button>
              {/* Not everything that catches a group offers a save. */}
              <button type="button" className="ghost" onClick={() => onAoeStep('apply')}>
                No save
              </button>
            </>
          )}

          {aoeStep === 'apply' && (
            <>
              <input
                className="aoe-amount num"
                inputMode="numeric"
                aria-label="AoE amount"
                placeholder="8+3"
                value={aoeAmount}
                onChange={(e) => onAoeAmountChange(e.target.value)}
              />
              <button type="button" className="ok" disabled={checked.size === 0} onClick={() => applyAoe(true)}>
                Heal
              </button>
              <button type="button" className="danger" disabled={checked.size === 0} onClick={() => applyAoe(false)}>
                Damage
              </button>
            </>
          )}

          <span className="spacer" />
          {step.advance && (
            <button
              type="button"
              className="primary aoe-advance"
              disabled={checked.size === 0}
              onClick={() => onAoeStep(AOE_STEPS[stepIndex + 1].id)}
            >
              {step.advance}
            </button>
          )}
        </div>
      ) : (
        <div className="turn-dock">
          <button type="button" className="icon-label" onClick={onArmAoe}>
            <Icon path={mdiVectorCircle} /> AoE
          </button>
          <button type="button" className="icon-label" onClick={() => setShowDice(true)}>
            <Icon path={mdiDiceMultiple} /> Dice
          </button>
          {unrolledNpcs.length > 0 && (
            <button
              type="button"
              className="icon-label"
              title="Roll initiative for all NPCs without a value"
              onClick={rollNpcs}
            >
              <Icon path={mdiDiceD20} /> Roll NPCs
            </button>
          )}
          <span className="spacer" />
        </div>
      )}

      {(state.expiredConditions.length > 0 || state.turnEvents.length > 0) && (
        <div className="toast" role="status">
          {state.turnEvents.map((message, i) => (
            <div key={`t${i}`}>{message}</div>
          ))}
          {state.expiredConditions.map((e, i) => (
            <div key={`e${i}`}>
              {e.condition} expired on {e.combatantName}
            </div>
          ))}
        </div>
      )}

      {/* The roller hands its total to the AoE bar rather than applying anything
          itself, and closes itself afterwards — see App.sendRollToAoe. */}
      {showDice && <DiceRoller onSendToAoe={onSendRollToAoe} onClose={() => setShowDice(false)} />}
      {groupFor && <AssignGroup ids={groupFor} onClose={() => setGroupFor(null)} />}
      {conditionsFor !== null && (
        <ConditionsDialog targets={conditionTargets} onClose={() => setConditionsFor(null)} />
      )}
    </section>
  )
}
