// Generates non-SRD Content Packs (one JSON per book) into the GITIGNORED
// fixtures/packs/ directory, for the GM to import locally via the Packs file
// picker. This tool reuses the same shared parser as build-srd.ts but WITHOUT
// the `srd52` filter — it captures everything the app can render for a book.
//
// IMPORTANT: the output is licensed, non-SRD 5e.tools content. It lands under
// fixtures/ (gitignored) and MUST NEVER be committed or hosted in this public
// repo. Only the SRD 5.2 subset (public/data/, via build-srd.ts) may ship.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseItem, parseMonster, parseSpell, slugId } from '../src/lib/parser.ts'
import { fetchJson, upstreamDataUrl } from './env.ts'

interface BookConfig {
  code: string
  packId: string
  name: string
}

interface SectionResult {
  status: 'ok' | 'missing' | 'empty'
  count: number
}

const baseUrl = upstreamDataUrl()
const configPath = resolve(import.meta.dirname, 'packs.config.json')
const allBooks = JSON.parse(readFileSync(configPath, 'utf8')) as BookConfig[]

// CLI args (if any) select a subset of books by source code (case-insensitive).
const wanted = process.argv.slice(2).map((c) => c.toUpperCase())
const books = wanted.length ? allBooks.filter((b) => wanted.includes(b.code.toUpperCase())) : allBooks
if (wanted.length && books.length !== wanted.length) {
  const known = allBooks.map((b) => b.code).join(', ')
  const unknown = wanted.filter((c) => !allBooks.some((b) => b.code.toUpperCase() === c))
  throw new Error(`Unknown book code(s): ${unknown.join(', ')}. Known: ${known}`)
}

const outDir = resolve(import.meta.dirname, '..', 'fixtures', 'packs')
mkdirSync(outDir, { recursive: true })

// Fetch that tolerates a missing upstream file (404) — not every book ships
// every category. Returns undefined so the caller can record it as "missing".
async function fetchOptional(relPath: string): Promise<unknown | undefined> {
  try {
    return await fetchJson(baseUrl, relPath)
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return undefined
    throw err
  }
}

// Items live in one shared file per-source; fetch once and reuse across books.
const itemsFileP = fetchOptional('items.json') as Promise<{ item?: { source?: string }[] } | undefined>
const itemsBaseFileP = fetchOptional('items-base.json') as Promise<{ baseitem?: { source?: string }[] } | undefined>
const [itemsFile, itemsBaseFile] = await Promise.all([itemsFileP, itemsBaseFileP])
const allRawItems = [...(itemsFile?.item ?? []), ...(itemsBaseFile?.baseitem ?? [])]

type Report = Record<string, Record<string, SectionResult>>
const report: Report = {}

for (const book of books) {
  const lc = book.code.toLowerCase()
  const [bestiaryFile, spellFile] = await Promise.all([
    fetchOptional(`bestiary/bestiary-${lc}.json`) as Promise<{ monster?: unknown[] } | undefined>,
    fetchOptional(`spells/spells-${lc}.json`) as Promise<{ spell?: unknown[] } | undefined>,
  ])

  const sections: Report[string] = {}

  const monsters = bestiaryFile
    ? (bestiaryFile.monster ?? []).map((raw) => {
        const parsed = parseMonster(raw as Parameters<typeof parseMonster>[0])
        return { ...parsed, id: slugId(parsed.name, parsed.source) }
      })
    : undefined
  sections.monsters = bestiaryFile
    ? { status: monsters!.length ? 'ok' : 'empty', count: monsters!.length }
    : { status: 'missing', count: 0 }

  const spells = spellFile
    ? (spellFile.spell ?? []).map((raw) => {
        const parsed = parseSpell(raw as Parameters<typeof parseSpell>[0])
        return { ...parsed, id: slugId(parsed.name, parsed.source) }
      })
    : undefined
  sections.spells = spellFile
    ? { status: spells!.length ? 'ok' : 'empty', count: spells!.length }
    : { status: 'missing', count: 0 }

  const rawItems = allRawItems.filter((it) => it.source === book.code)
  const items = rawItems.map((raw) => {
    const parsed = parseItem(raw as Parameters<typeof parseItem>[0])
    return { ...parsed, id: slugId(parsed.name, parsed.source) }
  })
  sections.items = { status: items.length ? 'ok' : 'empty', count: items.length }

  report[book.code] = sections

  const pack: {
    packId: string
    name: string
    version: string
    monsters?: unknown[]
    spells?: unknown[]
    items?: unknown[]
  } = { packId: book.packId, name: book.name, version: '' }
  if (monsters && monsters.length) pack.monsters = monsters
  if (spells && spells.length) pack.spells = spells
  if (items.length) pack.items = items

  const hasContent = pack.monsters || pack.spells || pack.items
  if (!hasContent) {
    console.warn(`⚠ ${book.code} (${book.name}): no monsters, spells, or items found — pack NOT written.`)
    continue
  }

  pack.version = createHash('sha256').update(JSON.stringify(pack)).digest('hex').slice(0, 16)
  const outFile = resolve(outDir, `${book.packId}.json`)
  writeFileSync(outFile, JSON.stringify(pack))
  console.log(`✓ ${book.code} → fixtures/packs/${book.packId}.json (v${pack.version})`)
}

// Summary table — surfaces any missing/empty category so gaps are never silent.
console.log('\nSummary (category: status/count):')
for (const book of books) {
  const s = report[book.code]
  const fmt = (r: SectionResult) => (r.status === 'missing' ? 'missing' : `${r.status} ${r.count}`)
  console.log(
    `  ${book.code.padEnd(6)} monsters: ${fmt(s.monsters).padEnd(12)} spells: ${fmt(s.spells).padEnd(12)} items: ${fmt(s.items)}`,
  )
}
