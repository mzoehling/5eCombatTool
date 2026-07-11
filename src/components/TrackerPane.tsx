import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useState } from 'react'
import { d20 } from '../lib/dice'
import { evalArithmetic } from '../lib/arithmetic'
import { battleStore, useBattleState } from '../store/battleStore'
import { sortedCombatants } from '../store/battleReducer'
import { AddBlank } from './AddBlank'
import { CombatantRow } from './CombatantRow'
import { Compendium } from './Compendium'
import { PacksManager } from './PacksManager'
import { ConditionEditor } from './ConditionEditor'
import { EditCombatant } from './EditCombatant'
import { GroupsEditor } from './GroupsEditor'

interface TrackerPaneProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TrackerPane({ selectedId, onSelect }: TrackerPaneProps) {
  const { dispatch } = battleStore
  const state = useBattleState()
  const [modal, setModal] = useState<'add' | 'groups' | 'compendium' | 'packs' | null>(null)
  const [conditionsFor, setConditionsFor] = useState<string | null>(null)
  const [editFor, setEditFor] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [aoeAmount, setAoeAmount] = useState('')

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

  // auto-clear condition-expiry notices
  useEffect(() => {
    if (!state.expiredConditions.length) return
    const timer = setTimeout(() => dispatch({ type: 'clearExpiredNotice' }), 5000)
    return () => clearTimeout(timer)
  }, [state.expiredConditions, dispatch])

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

  const rollMissing = () => {
    const ids = state.combatants.filter((c) => c.initiative === null && !c.isPC).map((c) => c.id)
    if (ids.length) dispatch({ type: 'rollInitiative', ids, rolls: ids.map(() => d20()) })
  }

  const applyAoe = (heal: boolean) => {
    const amount = evalArithmetic(aoeAmount)
    if (amount === null || amount <= 0 || checked.size === 0) return
    dispatch({ type: heal ? 'applyHealing' : 'applyDamage', ids: [...checked], amount })
    setAoeAmount('')
  }

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const conditionsCombatant = state.combatants.find((c) => c.id === conditionsFor)
  const editCombatant = state.combatants.find((c) => c.id === editFor)

  return (
    <section className="tracker-pane">
      <div className="tracker-toolbar">
        <button type="button" className="primary" onClick={() => setModal('compendium')}>
          📖 Compendium
        </button>
        <button type="button" onClick={() => setModal('add')}>＋ Blank</button>
        <button type="button" onClick={rollMissing} title="Roll initiative for monsters without a value">
          🎲 Roll missing
        </button>
        <button type="button" onClick={() => setModal('groups')}>Groups</button>
        <button type="button" onClick={() => setModal('packs')}>Packs</button>
        <button
          type="button"
          className={multiSelect ? 'primary' : ''}
          onClick={() => {
            setMultiSelect(!multiSelect)
            setChecked(new Set())
          }}
        >
          AoE
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="combatant-list">
            {ordered.map((c) => {
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
                  groupOut={group ? !group.inBattle : false}
                  onSelect={() => onSelect(c.id)}
                  onToggleCheck={() => toggleCheck(c.id)}
                  onEditConditions={() => setConditionsFor(c.id)}
                  onEdit={() => setEditFor(c.id)}
                />
              )
            })}
            {ordered.length === 0 && <li className="empty-hint">No combatants — add creatures to begin.</li>}
          </ul>
        </SortableContext>
      </DndContext>

      {multiSelect && (
        <div className="aoe-bar">
          <span>{checked.size} selected</span>
          <input
            inputMode="numeric"
            placeholder="Amount (e.g. 8+3)"
            value={aoeAmount}
            onChange={(e) => setAoeAmount(e.target.value)}
          />
          <button type="button" className="danger" onClick={() => applyAoe(false)}>
            Damage
          </button>
          <button type="button" className="ok" onClick={() => applyAoe(true)}>
            Heal
          </button>
        </div>
      )}

      {state.expiredConditions.length > 0 && (
        <div className="toast" role="status">
          {state.expiredConditions.map((e, i) => (
            <div key={i}>
              {e.condition} expired on {e.combatantName}
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && <AddBlank onClose={() => setModal(null)} />}
      {modal === 'groups' && <GroupsEditor onClose={() => setModal(null)} />}
      {modal === 'compendium' && <Compendium onClose={() => setModal(null)} />}
      {modal === 'packs' && <PacksManager onClose={() => setModal(null)} />}
      {conditionsCombatant && <ConditionEditor combatant={conditionsCombatant} onClose={() => setConditionsFor(null)} />}
      {editCombatant && <EditCombatant combatant={editCombatant} onClose={() => setEditFor(null)} />}
    </section>
  )
}
