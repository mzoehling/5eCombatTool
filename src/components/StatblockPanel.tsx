import { mdiPin, mdiPinOutline, mdiRestore } from '@mdi/js'
import { Fragment, useState } from 'react'
import { describeCondition } from '../data/conditionInfo'
import { parseDiceExpression } from '../lib/diceExpr'
import { renderTags } from '../lib/tagRenderer'
import { battleStore } from '../store/battleStore'
import { abilityMod, type Ability, type Combatant, type Statblock, type StatblockEntry } from '../types'
import { ApplyCondition } from './ApplyCondition'
import { DiceRoller } from './DiceRoller'
import { Icon } from './Icon'
import { SpellInfo } from './SpellInfo'
import { TaggedText } from './TaggedText'

/** Callbacks opening the dice roller / condition dialog / spell info from statblock text. */
interface TextActions {
  onDice: (expr: string) => void
  onCondition: (name: string) => void
  onSpell: (name: string) => void
}

type Tab = 'general' | 'traits' | 'actions' | 'spells' | 'uses' | 'conditions'

interface StatblockPanelProps {
  combatant: Combatant
  pinned: boolean
  onTogglePin: () => void
  /** Combatants pre-checked when applying a condition (AoE selection). */
  preselectIds?: ReadonlySet<string>
}

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const SIZE_NAMES: Record<string, string> = {
  T: 'Tiny',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  H: 'Huge',
  G: 'Gargantuan',
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

/** A d20 roll with a flat bonus (save, check, initiative) as a dice link. */
function D20Link({ bonus, onDice }: { bonus: number; onDice: (expr: string) => void }) {
  const expr = `1d20${signed(bonus)}`
  return (
    <button type="button" className="dice-link" title={`Roll ${expr}`} onClick={() => onDice(expr)}>
      {signed(bonus)}
    </button>
  )
}

function EntryList({ entries, title, actions }: { entries: StatblockEntry[]; title?: string; actions: TextActions }) {
  if (!entries.length) return null
  return (
    <section className="sb-section">
      {title && <h3>{title}</h3>}
      {entries.map((entry, i) => (
        <div key={i} className="sb-entry">
          {entry.name && <strong>{renderTags(entry.name)}. </strong>}
          {entry.text.map((t, j) => (
            <p key={j}>
              <TaggedText text={t} onDice={actions.onDice} onCondition={actions.onCondition} onSpell={actions.onSpell} />
            </p>
          ))}
        </div>
      ))}
    </section>
  )
}

function GeneralTab({ sb, actions }: { sb: Statblock; actions: TextActions }) {
  const hpFormula = sb.hp.formula
  return (
    <>
      <p className="sb-meta">
        {sb.size.map((s) => SIZE_NAMES[s] ?? s).join(' or ')} {sb.type}
        {sb.typeTags.length > 0 && ` (${sb.typeTags.join(', ')})`}, {sb.alignment}
      </p>
      <div className="sb-statline">
        <span>
          <b>AC</b> {sb.ac}
          {sb.acFrom && ` (${renderTags(sb.acFrom)})`}
        </span>
        <span>
          <b>Initiative</b> <D20Link bonus={sb.initiativeBonus} onDice={actions.onDice} />
        </span>
        <span>
          <b>HP</b> {sb.hp.special ?? sb.hp.average}
          {hpFormula &&
            (parseDiceExpression(hpFormula) !== null ? (
              <>
                {' ('}
                <button
                  type="button"
                  className="dice-link"
                  title={`Roll ${hpFormula}`}
                  onClick={() => actions.onDice(hpFormula)}
                >
                  {hpFormula}
                </button>
                {')'}
              </>
            ) : (
              ` (${hpFormula})`
            ))}
        </span>
        <span>
          <b>Speed</b>{' '}
          {sb.speed.map((s) => `${s.mode === 'walk' ? '' : `${s.mode} `}${s.value} ft.${s.condition ? ` ${s.condition}` : ''}`).join(', ') || '—'}
        </span>
      </div>
      <table className="sb-abilities">
        <thead>
          <tr>
            <th />
            {ABILITIES.map((a) => (
              <th key={a}>{a.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Score</th>
            {ABILITIES.map((a) => (
              <td key={a}>{sb.abilities[a]}</td>
            ))}
          </tr>
          <tr>
            <th>Mod</th>
            {ABILITIES.map((a) => (
              <td key={a}>
                <D20Link bonus={abilityMod(sb.abilities[a])} onDice={actions.onDice} />
              </td>
            ))}
          </tr>
          <tr>
            <th>Save</th>
            {ABILITIES.map((a) => (
              <td key={a}>
                <D20Link bonus={sb.saves[a] ?? abilityMod(sb.abilities[a])} onDice={actions.onDice} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <dl className="sb-details">
        {Object.keys(sb.skills).length > 0 && (
          <>
            <dt>Skills</dt>
            <dd>
              {Object.entries(sb.skills).map(([name, bonus], i) => (
                <Fragment key={name}>
                  {i > 0 && ', '}
                  {name.replace(/^./, (c) => c.toUpperCase())} <D20Link bonus={bonus} onDice={actions.onDice} />
                </Fragment>
              ))}
            </dd>
          </>
        )}
        {sb.resistances && (
          <>
            <dt>Resistances</dt>
            <dd>{renderTags(sb.resistances)}</dd>
          </>
        )}
        {sb.vulnerabilities && (
          <>
            <dt>Vulnerabilities</dt>
            <dd>{renderTags(sb.vulnerabilities)}</dd>
          </>
        )}
        {sb.immunities && (
          <>
            <dt>Immunities</dt>
            <dd>{renderTags(sb.immunities)}</dd>
          </>
        )}
        {sb.gear.length > 0 && (
          <>
            <dt>Gear</dt>
            <dd>{sb.gear.map((g) => renderTags(g)).join(', ')}</dd>
          </>
        )}
        {sb.senses.length > 0 && (
          <>
            <dt>Senses</dt>
            <dd>
              {sb.senses.map((s) => renderTags(s)).join(', ')}
              {sb.passivePerception !== undefined && `; Passive Perception ${sb.passivePerception}`}
            </dd>
          </>
        )}
        {sb.languages.length > 0 && (
          <>
            <dt>Languages</dt>
            <dd>{sb.languages.map((l) => renderTags(l)).join(', ')}</dd>
          </>
        )}
        {sb.cr !== undefined && (
          <>
            <dt>CR</dt>
            <dd>{sb.cr}</dd>
          </>
        )}
      </dl>
    </>
  )
}

function SpellsTab({ sb, actions }: { sb: Statblock; actions: TextActions }) {
  if (!sb.spellcasting.length) return <p className="dim">No spellcasting.</p>
  return (
    <>
      {sb.spellcasting.map((sc, i) => (
        <section key={i} className="sb-section">
          <h3>{sc.name}</h3>
          {sc.headerText.map((t, j) => (
            <p key={j}>
              <TaggedText text={t} onDice={actions.onDice} onCondition={actions.onCondition} onSpell={actions.onSpell} />
            </p>
          ))}
          {sc.lists.map((list, j) => (
            <div key={j} className="sb-entry">
              <strong>{list.label}: </strong>
              {list.spells.map((s, k) => (
                <Fragment key={k}>
                  {k > 0 && ', '}
                  <TaggedText text={s} onDice={actions.onDice} onCondition={actions.onCondition} onSpell={actions.onSpell} />
                </Fragment>
              ))}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

function ConditionsTab({ combatant }: { combatant: Combatant }) {
  if (!combatant.conditions.length) return <p className="dim">No active conditions.</p>
  return (
    <>
      {combatant.conditions.map((cond) => (
        <section key={cond.condition} className="sb-section">
          <h3>
            {cond.condition === 'Exhaustion' ? `Exhaustion — Level ${cond.level ?? 1}` : cond.condition}
            {cond.remainingRounds !== undefined && (
              <span className="dim"> ({cond.remainingRounds} {cond.remainingRounds === 1 ? 'round' : 'rounds'} left)</span>
            )}
          </h3>
          <p>{describeCondition(cond.condition) ?? 'Custom effect — no rules text.'}</p>
          {cond.note && <p className="dim">Note: {cond.note}</p>}
        </section>
      ))}
    </>
  )
}

function UsesTab({ combatant }: { combatant: Combatant }) {
  const { dispatch } = battleStore
  if (!combatant.limits.length) return <p className="dim">No limited-use abilities detected.</p>
  return (
    <ul className="uses-list">
      {combatant.limits.map((limit) => {
        const remaining = limit.max - limit.used
        return (
          <li key={limit.id}>
            <button
              type="button"
              className="use-btn"
              disabled={remaining <= 0}
              onClick={() => dispatch({ type: 'consumeLimit', id: combatant.id, limitId: limit.id, delta: 1 })}
            >
              <span className="use-name">{limit.name}</span>
              <span className="use-pips">
                {Array.from({ length: limit.max }, (_, i) => (
                  <span key={i} className={i < remaining ? 'pip full' : 'pip'} />
                ))}
              </span>
              <span className="use-count">
                {remaining}/{limit.max}
              </span>
            </button>
            <button
              type="button"
              className="ghost"
              aria-label={`Restore ${limit.name}`}
              disabled={limit.used <= 0}
              onClick={() => dispatch({ type: 'consumeLimit', id: combatant.id, limitId: limit.id, delta: -1 })}
            >
              <Icon path={mdiRestore} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function StatblockPanel({ combatant, pinned, onTogglePin, preselectIds }: StatblockPanelProps) {
  const [tab, setTab] = useState<Tab>('general')
  const [rollExpr, setRollExpr] = useState<string | null>(null)
  const [conditionFor, setConditionFor] = useState<string | null>(null)
  const [spellFor, setSpellFor] = useState<string | null>(null)
  const sb = combatant.statblock
  const actions: TextActions = { onDice: setRollExpr, onCondition: setConditionFor, onSpell: setSpellFor }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'general', label: 'General', show: true },
    { id: 'traits', label: 'Traits', show: !!sb && sb.traits.length > 0 },
    { id: 'actions', label: 'Actions', show: !!sb },
    { id: 'spells', label: 'Spells', show: !!sb && sb.spellcasting.length > 0 },
    { id: 'uses', label: 'Uses', show: true },
    { id: 'conditions', label: 'Active Conditions', show: combatant.conditions.length > 0 },
  ]

  // fall back when the selected tab disappears (e.g. last condition removed)
  const shownTab = tabs.some((t) => t.id === tab && t.show) ? tab : 'general'

  return (
    <div className="statblock">
      <header className="sb-header">
        <h2>{sb?.name ?? combatant.name}</h2>
        <button
          type="button"
          className={pinned ? 'primary' : ''}
          onClick={onTogglePin}
          aria-label={pinned ? 'Unpin statblock' : 'Pin statblock'}
          title="Pinned statblocks do not switch with the turn"
        >
          <Icon path={pinned ? mdiPin : mdiPinOutline} />
        </button>
      </header>

      <nav className="sb-tabs">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.id} type="button" className={shownTab === t.id ? 'primary' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
      </nav>

      <div className="sb-content">
        {shownTab === 'general' &&
          (sb ? (
            <GeneralTab sb={sb} actions={actions} />
          ) : (
            <dl className="sb-details">
              <dt>AC</dt>
              <dd>{combatant.armorClass}</dd>
              <dt>HP</dt>
              <dd>
                {combatant.hp}/{combatant.maxHp}
              </dd>
              <dt>Initiative</dt>
              <dd>{signed(combatant.initiativeBonus)}</dd>
            </dl>
          ))}
        {shownTab === 'traits' && sb && <EntryList entries={sb.traits} actions={actions} />}
        {shownTab === 'actions' && sb && (
          <>
            <EntryList entries={sb.actions} title="Actions" actions={actions} />
            <EntryList entries={sb.bonusActions} title="Bonus Actions" actions={actions} />
            <EntryList entries={sb.reactions} title="Reactions" actions={actions} />
            {sb.legendary.length > 0 && (
              <section className="sb-section">
                <h3>Legendary Actions{sb.legendaryActions ? ` (${sb.legendaryActions}/Turn)` : ''}</h3>
                {sb.legendaryHeader?.map((t, i) => <p key={i}>{renderTags(t)}</p>)}
                {sb.legendary.map((entry, i) => (
                  <div key={i} className="sb-entry">
                    {entry.name && <strong>{renderTags(entry.name)}. </strong>}
                    {entry.text.map((t, j) => (
                      <p key={j}>
                        <TaggedText text={t} onDice={setRollExpr} onCondition={setConditionFor} onSpell={setSpellFor} />
                      </p>
                    ))}
                  </div>
                ))}
              </section>
            )}
            <EntryList entries={sb.lair} title="Lair Actions" actions={actions} />
          </>
        )}
        {shownTab === 'spells' && sb && <SpellsTab sb={sb} actions={actions} />}
        {shownTab === 'uses' && <UsesTab combatant={combatant} />}
        {shownTab === 'conditions' && <ConditionsTab combatant={combatant} />}
      </div>

      {/* spell info first: dice/condition dialogs opened from spell text must stack above it */}
      {spellFor !== null && (
        <SpellInfo
          name={spellFor}
          onDice={setRollExpr}
          onCondition={setConditionFor}
          onSpell={setSpellFor}
          onClose={() => setSpellFor(null)}
        />
      )}
      {rollExpr !== null && <DiceRoller allowApply initialExpression={rollExpr} onClose={() => setRollExpr(null)} />}
      {conditionFor !== null && (
        <ApplyCondition name={conditionFor} preselect={preselectIds} onClose={() => setConditionFor(null)} />
      )}
    </div>
  )
}
