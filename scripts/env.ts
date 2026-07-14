import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Base URL of the upstream JSON data source. Comes from the environment
 * (CI: repository secret) or from a gitignored .env.local file. The URL is
 * deliberately not part of the repository.
 */
export function upstreamDataUrl(): string {
  if (process.env.UPSTREAM_DATA_URL) return process.env.UPSTREAM_DATA_URL.replace(/\/$/, '')

  try {
    const envFile = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf8')
    const match = envFile.match(/^UPSTREAM_DATA_URL=(.+)$/m)
    if (match) return match[1].trim().replace(/\/$/, '')
  } catch {
    // no .env.local — fall through to the error below
  }

  throw new Error(
    'UPSTREAM_DATA_URL is not set. Provide it as an environment variable or in .env.local (see .env.example).',
  )
}

export const FIXTURE_FILES = [
  'bestiary/bestiary-xmm.json',
  'spells/spells-xphb.json',
  'items.json',
  'items-base.json',
  'variantrules.json',
  'actions.json',
  'senses.json',
  'skills.json',
  'conditionsdiseases.json',
] as const

export async function fetchJson(baseUrl: string, relPath: string): Promise<unknown> {
  const url = `${baseUrl}/${relPath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${relPath}: HTTP ${res.status}`)
  return res.json()
}
