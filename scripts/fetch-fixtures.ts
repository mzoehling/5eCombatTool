import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { FIXTURE_FILES, fetchJson, upstreamDataUrl } from './env.ts'

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures')
const baseUrl = upstreamDataUrl()

for (const relPath of FIXTURE_FILES) {
  const data = await fetchJson(baseUrl, relPath)
  const target = resolve(fixturesDir, relPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(data))
  console.log(`fetched ${relPath}`)
}
