import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { mdiChevronDown, mdiDiceD20, mdiDiceMultiple, mdiVectorCircle } from '@mdi/js'
import { Fragment, useEffect, useState } from 'react'
import { evalArithmetic } from '../lib/arithmetic'
import { d20 } from '../lib/dice'
import { parseDiceExpression, rollDiceExpression } from '../lib/diceExpr'
import { battleStore, useBattleState } from '../store/battleStore'
import { sortedCombatants } from '../store/battleReducer'
import { derivedGroupName, groupedInitiativeRolls, groupRuns, nextGroupColor } from '../lib/groups'
import { newId } from '../lib/id'
import { amountAfterSave, readSave, SAVE_ABILITIES, saveBonus, type SaveVerdict } from '../lib/saves'
import { CONDITIONS, type Ability, type Combatant } from '../types'
import { ApplyCondition } from './ApplyCondition'
import { BattleControls } from './BattleControls'
import { CombatantRow } from './CombatantRow'
import { GroupRow } from './GroupRow'
import { ConditionEditor } from './ConditionEditor'
import { DiceRoller } from './DiceRoller'
import { EditCombatant } from './EditCombatant'
import { Icon } from './Icon'

interface TrackerPaneProps {
  selectedId: string | null
  onSelect: (id: string) => void
  /** AoE multi-select state is owned by App (shared with the statblock panel). */
  multiSelect: boolean
  onMultiSelectChange: (on: boolean) => void
  checked: ReadonlySet<string>
  onCheckedChange: (checked: ReadonlySet<string>) => void
}

export function TrackerPane({
  selectedId,
  onSelect,
  multiSelect,
  onMultiSelectChange,
  checked,
  onCheckedChange,
}: TrackerPaneProps) {
  const { dispatch } = battleStore
  const state = useBattleState()
  const [showDice, setShowDice] = useState(false)
  const [conditionsFor, setConditionsFor] = useState<string | null>(null)
  const [editFor, setEditFor] = useState<string | null>(null)
  const [aoeAmount, setAoeAmount] = useState('')
  const [aoeCondition, setAoeCondition] = useState<string | null>(null)
  // Collapsed by default: a group the DM never opens is a group they read as
  // one thing. Expansion is per run and lives in the UI, not in battle state.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set())
  // Save helper: the one bit of arithmetic the AoE bar otherwise leaves to the
  // DM. Rolling for the table is optional — a verdict can be flipped by hand.
  const [saveAbility, setSaveAbility] = useState<Ability | null>(null)
  const [saveDc, setSaveDc] = useState('')
  const [saves, setSaves] = useState<ReadonlyMap<string, { roll: number; total: number; verdict: SaveVerdict }>>(
    new Map(),
  )

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
  const isTied = (init: number | null) => init !== null && (initiativeCounts.get(init) ?? 0) > 1

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

  const applyAoe = (heal: boolean) => {
    // Dice notation is rolled once for the whole area, which is what the rules
    // say: a fireball deals one damage roll to everyone it catches.
    const amount = evalArithmetic(aoeAmount) ?? rollDiceExpression(aoeAmount)?.total ?? null
    if (amount === null || amount <= 0 || checked.size === 0) return
    const type = heal ? ('applyHealing' as const) : ('applyDamage' as const)
    // A made save halves damage, so the two groups go out as two dispatches —
    // the reducer applies one amount per action, with its own temp-HP handling
    // per target either way. Healing is never halved by a save.
    const halfIds = heal ? [] : [...checked].filter((id) => saves.get(id)?.verdict === 'saved')
    const fullIds = [...checked].filter((id) => !halfIds.includes(id))
    const halfAmount = Math.floor(amount / 2)
    if (fullIds.length) dispatch({ type, ids: fullIds, amount })
    if (halfIds.length && halfAmount > 0) dispatch({ type, ids: halfIds, amount: halfAmount })
    setAoeAmount('')
    setSaves(new Map())
  }

  /** Rolls a save for every checked combatant and reads it against the DC. */
  const rollSaves = () => {
    const dc = Number.parseInt(saveDc, 10)
    if (!saveAbility || !Number.isFinite(dc)) return
    const next = new Map<string, { roll: number; total: number; verdict: SaveVerdict }>()
    for (const c of ordered) {
      if (!checked.has(c.id)) continue
      const roll = d20()
      const total = roll + saveBonus(c, saveAbility)
      next.set(c.id, { roll, total, verdict: readSave(roll, saveBonus(c, saveAbility), dc) })
    }
    setSaves(next)
  }

  const flipVerdict = (id: string) => {
    const current = saves.get(id)
    if (!current) return
    const next = new Map(saves)
    next.set(id, { ...current, verdict: current.verdict === 'saved' ? 'failed' : 'saved' })
    setSaves(next)
  }

  // NPCs whose initiative is still unset — PCs roll at the table
  const unrolledNpcs = state.combatants.filter((c) => !c.isPC && (c.initiative ?? 0) === 0)
  // One roll per group: six goblins roll once at a real table, not six times.
  const rollNpcs = () => {
    const { ids, rolls } = groupedInitiativeRolls(unrolledNpcs, d20)
    dispatch({ type: 'rollInitiative', ids, rolls })
  }

  /** Turns the current AoE selection into a group — the moment the DM has just
   *  said, by picking them, that these belong together. */
  const groupSelection = () => {
    if (checked.size === 0) return
    const names = ordered.filter((c) => checked.has(c.id)).map((c) => c.name)
    const id = newId()
    dispatch({
      type: 'addGroup',
      group: {
        id,
        name: derivedGroupName(names, state.battle.groups),
        inBattle: true,
        color: nextGroupColor(state.battle.groups.length),
      },
    })
    for (const combatantId of checked) dispatch({ type: 'assignGroup', combatantId, groupId: id })
  }

  const toggleCheck = (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onCheckedChange(next)
  }

  const conditionsCombatant = state.combatants.find((c) => c.id === conditionsFor)
  const editCombatant = state.combatants.find((c) => c.id === editFor)

  // Live per-row preview of what the AoE bar would apply. Only a usable amount
  // produces one, so an empty or half-typed field shows nothing. Dice cannot be
  // previewed as a number — the roll happens on apply — so the row shows the
  // notation instead, halved or not exactly as the total will be.
  const aoeValue = evalArithmetic(aoeAmount)
  const aoeDice = aoeValue === null && parseDiceExpression(aoeAmount) !== null
  const aoePreview = multiSelect && aoeValue !== null && aoeValue > 0 ? aoeValue : null
  const previewLabel = (id: string): string | undefined => {
    const halved = saves.get(id)?.verdict === 'saved'
    if (aoePreview !== null) return `−${amountAfterSave(aoePreview, saves.get(id)?.verdict)} hp`
    if (multiSelect && aoeDice) return `−${halved ? '½ ' : ''}${aoeAmount.trim()}`
    return undefined
  }
  const savedCount = [...checked].filter((id) => saves.get(id)?.verdict === 'saved').length
  // Grouping a selection that is already grouped would silently move those
  // combatants out of the group they came from, so it is offered only for a
  // selection that has no group yet.
  const checkedGrouped = ordered.filter((c) => checked.has(c.id) && c.groupId).length

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
                  aoePreview={checked.has(c.id) ? previewLabel(c.id) : undefined}
                  aoeSave={multiSelect && checked.has(c.id) ? saves.get(c.id) : undefined}
                  onToggleSave={() => flipVerdict(c.id)}
                  onSelect={() => onSelect(c.id)}
                  onToggleCheck={() => toggleCheck(c.id)}
                  onEditConditions={() => setConditionsFor(c.id)}
                  onEdit={() => setEditFor(c.id)}
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

      {/* The dock is pinned below the list: mode switches on the left, turn
          control hard right, so neither moves while the list scrolls. In AoE
          mode the same strip becomes the AoE bar. */}
      {multiSelect ? (
        <div className="aoe-bar">
          <span className="aoe-count">{checked.size} selected</span>
          <button type="button" className="ghost" onClick={() => onCheckedChange(new Set(ordered.map((c) => c.id)))}>
            All visible
          </button>
          <button type="button" className="ghost" disabled={checked.size === 0} onClick={() => onCheckedChange(new Set())}>
            Clear
          </button>
          <input
            className="aoe-amount"
            inputMode="numeric"
            aria-label="AoE amount"
            placeholder="8+3"
            value={aoeAmount}
            onChange={(e) => setAoeAmount(e.target.value)}
          />
          <button type="button" className="danger" disabled={checked.size === 0} onClick={() => applyAoe(false)}>
            {savedCount > 0 ? `Damage · ${checked.size - savedCount} full, ${savedCount} half` : 'Damage'}
          </button>
          <button type="button" className="ok" disabled={checked.size === 0} onClick={() => applyAoe(true)}>
            Heal
          </button>
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={() => setAoeCondition(CONDITIONS[0])}
          >
            Condition…
          </button>
          <button
            type="button"
            disabled={checked.size === 0 || checkedGrouped > 0}
            title={
              checkedGrouped > 0
                ? 'Some of these are already in a group — move them out from their edit dialog first'
                : 'Turn this selection into a group'
            }
            onClick={groupSelection}
          >
            Group
          </button>
          {/* Save helper. Choosing an ability and a DC turns the bar's flat
              amount into a per-target read: failures take full, passes half. */}
          <span className="aoe-save">
            <select
              aria-label="Save ability"
              value={saveAbility ?? ''}
              onChange={(e) => {
                setSaveAbility((e.target.value || null) as Ability | null)
                setSaves(new Map())
              }}
            >
              <option value="">No save</option>
              {SAVE_ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {a.toUpperCase()}
                </option>
              ))}
            </select>
            {saveAbility && (
              <>
                <input
                  className="aoe-dc"
                  inputMode="numeric"
                  aria-label="Save DC"
                  placeholder="DC"
                  value={saveDc}
                  onChange={(e) => setSaveDc(e.target.value)}
                />
                <button
                  type="button"
                  disabled={checked.size === 0 || !Number.isFinite(Number.parseInt(saveDc, 10))}
                  onClick={rollSaves}
                >
                  Roll saves
                </button>
              </>
            )}
          </span>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={() => onMultiSelectChange(false)}>
            Done
          </button>
        </div>
      ) : (
        <div className="turn-dock">
          <button type="button" className="icon-label" onClick={() => onMultiSelectChange(true)}>
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
          <BattleControls />
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

      {showDice && <DiceRoller allowApply onClose={() => setShowDice(false)} />}
      {aoeCondition && (
        <ApplyCondition
          name={aoeCondition}
          preselect={checked}
          onPickCondition={setAoeCondition}
          onClose={() => setAoeCondition(null)}
        />
      )}
      {conditionsCombatant && <ConditionEditor combatant={conditionsCombatant} onClose={() => setConditionsFor(null)} />}
      {editCombatant && <EditCombatant combatant={editCombatant} onClose={() => setEditFor(null)} />}
    </section>
  )
}
