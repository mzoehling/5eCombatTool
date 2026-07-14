// Generates the bundled SRD 5.2 data (CC-BY-4.0) in public/data/.
// Fetches the upstream sources, keeps only entries where `srd52` is truthy
// (a string value = the entry is renamed in the SRD → use the SRD name),
// and normalizes them with the shared parser.

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseItem, parseMonster, parseRule, parseSpell, slugId } from '../src/lib/parser.ts'
import { fetchJson, upstreamDataUrl } from './env.ts'

interface SrdFlagged {
  name: string
  source?: string
  srd52?: boolean | string
}

function filterSrd<T extends SrdFlagged>(entries: T[]): T[] {
  return entries
    .filter((e) => e.srd52)
    .map((e) => (typeof e.srd52 === 'string' ? { ...e, name: e.srd52 } : e))
}

const baseUrl = upstreamDataUrl()
const outDir = resolve(import.meta.dirname, '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const [bestiary, spellbook, items, itemsBase, variantrules, actions, senses, skills, conditions] = (await Promise.all([
  fetchJson(baseUrl, 'bestiary/bestiary-xmm.json'),
  fetchJson(baseUrl, 'spells/spells-xphb.json'),
  fetchJson(baseUrl, 'items.json'),
  fetchJson(baseUrl, 'items-base.json'),
  fetchJson(baseUrl, 'variantrules.json'),
  fetchJson(baseUrl, 'actions.json'),
  fetchJson(baseUrl, 'senses.json'),
  fetchJson(baseUrl, 'skills.json'),
  fetchJson(baseUrl, 'conditionsdiseases.json'),
])) as [
  { monster: (SrdFlagged & Parameters<typeof parseMonster>[0])[] },
  { spell: (SrdFlagged & Parameters<typeof parseSpell>[0])[] },
  { item: (SrdFlagged & Parameters<typeof parseItem>[0])[] },
  { baseitem: (SrdFlagged & Parameters<typeof parseItem>[0])[] },
  { variantrule: (SrdFlagged & Parameters<typeof parseRule>[0])[] },
  { action: (SrdFlagged & Parameters<typeof parseRule>[0])[] },
  { sense: (SrdFlagged & Parameters<typeof parseRule>[0])[] },
  { skill: (SrdFlagged & Parameters<typeof parseRule>[0])[] },
  { condition: (SrdFlagged & Parameters<typeof parseRule>[0])[]; status: (SrdFlagged & Parameters<typeof parseRule>[0])[] },
]

const monsters = filterSrd(bestiary.monster).map((raw) => {
  const parsed = parseMonster(raw)
  return { ...parsed, id: slugId(parsed.name, parsed.source) }
})
const spells = filterSrd(spellbook.spell).map((raw) => {
  const parsed = parseSpell(raw)
  return { ...parsed, id: slugId(parsed.name, parsed.source) }
})
const itemCount = filterSrd(items.item).length
const allItems = [...filterSrd(items.item), ...filterSrd(itemsBase.baseitem)].map((raw) => {
  const parsed = parseItem(raw)
  return { ...parsed, id: slugId(parsed.name, parsed.source) }
})
// "Concentration" is already tracked as an app condition (see src/data/conditionInfo.ts)
// and resolved via the condition-apply flow, not the rules glossary.
const glossaryRules = [
  ...filterSrd(variantrules.variantrule),
  ...filterSrd(actions.action),
  ...filterSrd(senses.sense),
  ...filterSrd(skills.skill),
  ...filterSrd(conditions.condition),
  ...filterSrd(conditions.status).filter((s) => s.name !== 'Concentration'),
].map((raw) => {
  const parsed = parseRule(raw)
  return { ...parsed, id: slugId(parsed.name, parsed.source) }
})

const files = {
  'srd-monsters.json': monsters,
  'srd-spells.json': spells,
  'srd-items.json': allItems,
  'srd-rules.json': glossaryRules,
}

const hash = createHash('sha256')
for (const [name, data] of Object.entries(files)) {
  const json = JSON.stringify(data)
  hash.update(json)
  writeFileSync(resolve(outDir, name), json)
}

const meta = {
  version: hash.digest('hex').slice(0, 16),
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    monsters: monsters.length,
    spells: spells.length,
    items: itemCount,
    baseItems: allItems.length - itemCount,
    rules: glossaryRules.length,
  },
}
writeFileSync(resolve(outDir, 'srd-meta.json'), JSON.stringify(meta, null, 2))

console.log(`SRD data written to public/data (version ${meta.version}):`)
console.log(
  `  monsters: ${meta.counts.monsters}, spells: ${meta.counts.spells}, items: ${meta.counts.items} + ${meta.counts.baseItems} base, rules: ${meta.counts.rules}`,
)
